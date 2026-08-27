/**
 * Imperative sentence-level audio queue with preloading.
 *
 * Manages sequential playback of audio chunks using the Web Audio API.
 * Automatically preloads upcoming chunks in the background so playback
 * is gapless — the next sentence starts immediately when the previous ends.
 *
 * Designed to be called directly from event handlers (e.g. SSE sentence events).
 */

export interface SentenceQueueCallbacks {
  onStart?: (index: number) => void;
  onEnd?: (index: number) => void;
  onError?: (index: number, error: unknown) => void;
  onFinished?: () => void;
}

export interface SentenceQueueOptions extends SentenceQueueCallbacks {
  /** Playback rate. 1.0 = normal, <1.0 = slower, >1.0 = faster. Default: 1.0 */
  playbackRate?: number;
}

interface QueueItem {
  index: number;
  audio: AudioBuffer | string;
  text?: string;
}

export class SentenceAudioQueue {
  private audioCtx: AudioContext;
  private items: QueueItem[] = [];
  private preloaded = new Map<number, AudioBuffer>();
  private currentSource: AudioBufferSourceNode | null = null;
  private isPlaying = false;
  private currentIndex = -1;
  private callbacks: SentenceQueueCallbacks;
  private playbackRate: number;
  /** Generation counter — incremented on stop() to cancel in-flight async work. */
  private liveGeneration = 0;
  /** Timer ID for the punctuation-pause setTimeout, so stop() can clear it. */
  private pendingTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(audioCtx: AudioContext, options: SentenceQueueOptions = {}) {
    this.audioCtx = audioCtx;
    const { playbackRate = 1.0, ...callbacks } = options;
    this.playbackRate = playbackRate;
    this.callbacks = callbacks;
  }

  /** Call this whenever a new sentence audio URL or decoded buffer arrives. */
  enqueue(index: number, audio: AudioBuffer | string, text?: string) {
    console.log(
      `[SentenceAudioQueue] enqueue index=${index} isPlaying=${this.isPlaying} ctxState=${this.audioCtx.state} queueLen=${this.items.length}`
    );
    this.items.push({ index, audio, text });
    if (!this.isPlaying) {
      this.playNext();
    } else if (typeof audio === "string") {
      // Preload URL-based items in the background; buffers are already decoded.
      this.preloadItem(index, audio);
    }
  }

  /** Determine how long to pause after a chunk based on trailing punctuation. */
  private getPauseMs(text: string | undefined): number {
    if (!text) return 0;
    const trimmed = text.trim();

    // Paragraph / ellipsis break (longest pause)
    if (trimmed.endsWith("…") || trimmed.endsWith("...")) return 600;

    // Sentence endings
    if (/[.!?。؟！]$/.test(trimmed)) return 400;

    // Semicolon / colon
    if (trimmed.endsWith(";") || trimmed.endsWith(":")) return 250;

    // Dash
    if (trimmed.endsWith("—") || trimmed.endsWith("-")) return 200;

    // Comma
    if (trimmed.endsWith(",") || trimmed.endsWith("،")) return 180;

    return 0;
  }

  /** Current sentence being played (or -1 if idle). */
  getCurrentIndex(): number {
    return this.currentIndex;
  }

  /** Whether audio is currently playing. */
  getIsPlaying(): boolean {
    return this.isPlaying;
  }

  /** Remaining items in the queue. */
  getQueueLength(): number {
    return this.items.length;
  }

  /** Stop everything and clear the queue. Safe to call multiple times. */
  stop() {
    this.liveGeneration++; // invalidate all in-flight async work for old generation
    if (this.pendingTimer) {
      clearTimeout(this.pendingTimer);
      this.pendingTimer = null;
    }
    if (this.currentSource) {
      try {
        this.currentSource.onended = null;
        this.currentSource.stop();
      } catch {
        // already stopped
      }
      this.currentSource = null;
    }
    this.items = [];
    this.preloaded.clear();
    this.isPlaying = false;
    this.currentIndex = -1;
  }

  /** Preload a single item in the background (non-blocking). */
  private async preloadItem(index: number, url: string) {
    const myGen = this.liveGeneration;
    if (this.preloaded.has(index) || myGen !== this.liveGeneration) return;

    try {
      const res = await fetch(url);
      if (!res.ok || myGen !== this.liveGeneration) return;

      const arrayBuffer = await res.arrayBuffer();
      if (myGen !== this.liveGeneration) return;

      const audioBuffer = await this.audioCtx.decodeAudioData(arrayBuffer);
      if (myGen !== this.liveGeneration) return;

      if (audioBuffer.duration > 0 && Number.isFinite(audioBuffer.duration)) {
        this.preloaded.set(index, audioBuffer);
      }
    } catch {
      // Preload failure is silent — playNext will retry or skip
    }
  }

  private async playNext() {
    const myGen = this.liveGeneration;

    if (this.items.length === 0) {
      this.isPlaying = false;
      this.currentIndex = -1;
      this.callbacks.onFinished?.();
      return;
    }

    this.isPlaying = true;
    const item = this.items.shift()!;
    this.currentIndex = item.index;
    this.callbacks.onStart?.(item.index);

    // Resume context if suspended (autoplay policy)
    if (this.audioCtx.state === "suspended") {
      console.log("[SentenceAudioQueue] Resuming suspended AudioContext...");
      try {
        await this.audioCtx.resume();
        console.log(`[SentenceAudioQueue] AudioContext resumed: state=${this.audioCtx.state}`);
      } catch (err) {
        console.warn("[SentenceAudioQueue] Failed to resume AudioContext:", err);
      }
    }

    // ── Resolve audio buffer ───────────────────────────────────────────
    let audioBuffer: AudioBuffer | undefined;

    if (typeof item.audio === "string") {
      // URL-based item: try the preloaded buffer first, otherwise fetch + decode.
      audioBuffer = this.preloaded.get(item.index);
      this.preloaded.delete(item.index); // free memory

      if (!audioBuffer) {
        try {
          const res = await fetch(item.audio);
          if (myGen !== this.liveGeneration) return;

          if (!res.ok) {
            console.warn(`[SentenceAudioQueue] Fetch failed: ${res.status}`);
            this.callbacks.onError?.(item.index, new Error(`HTTP ${res.status}`));
            this.playNext();
            return;
          }

          const arrayBuffer = await res.arrayBuffer();
          if (myGen !== this.liveGeneration) return;

          audioBuffer = await this.audioCtx.decodeAudioData(arrayBuffer);
          console.log(`[Queue] Decoded buffer duration=${audioBuffer?.duration ?? "null"}`);
          if (myGen !== this.liveGeneration) return;
        } catch (err) {
          if (myGen !== this.liveGeneration) return;
          console.warn("[SentenceAudioQueue] Playback failed:", err);
          this.callbacks.onError?.(item.index, err);
          this.currentSource = null;
          this.playNext();
          return;
        }
      }
    } else {
      // Decoded buffer provided directly (e.g. base64 audio from speak-stream).
      audioBuffer = item.audio;
    }

    if (!audioBuffer || audioBuffer.duration <= 0 || !Number.isFinite(audioBuffer.duration)) {
      console.warn(`[SentenceAudioQueue] Invalid buffer duration`);
      this.callbacks.onError?.(item.index, new Error("Invalid buffer"));
      this.playNext();
      return;
    }

    if (myGen !== this.liveGeneration) return;

    // Start playing immediately
    const source = this.audioCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.playbackRate.value = this.playbackRate;
    source.connect(this.audioCtx.destination);
    this.currentSource = source;

    const mySource = source;
    source.onended = () => {
      if (this.currentSource !== mySource) return;
      if (myGen !== this.liveGeneration) return;
      this.currentSource = null;
      this.callbacks.onEnd?.(item.index);

      // If the just-played chunk ends with punctuation that needs a pause,
      // delay the next chunk briefly so the pause feels natural.
      const pauseMs = this.getPauseMs(item.text);
      if (pauseMs > 0 && this.items.length > 0) {
        this.pendingTimer = setTimeout(() => {
          this.pendingTimer = null;
          this.playNext();
        }, pauseMs);
      } else {
        this.playNext();
      }
    };

    source.start(0);
  }
}
