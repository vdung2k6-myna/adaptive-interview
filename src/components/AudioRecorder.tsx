"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { useTranslations } from "next-intl";
import {
  assembleCapture,
  CAPTURE_CHANNELS,
  CAPTURE_SAMPLE_RATE,
} from "@/lib/audio/capture-assembly";

interface AudioRecorderProps {
  /**
   * The finished recording, and the id it was sent under when windowed ingestion is on.
   *
   * The id is absent on the whole-body path, and the caller then sends the blob as it always has.
   */
  onRecordingComplete: (blob: Blob, durationMs: number, turnId?: string) => void;
  /**
   * Turns windowed ingestion on.
   *
   * Given the turn's id, answers with the function that sends one window. The recorder calls that
   * function as each window is converted, in order, and awaits it — so the windows on the wire are
   * the frames the finished recording is assembled from, and at most one is in flight.
   *
   * Absent, the recording is held and handed over whole, which is the behaviour the client had
   * before windows existed.
   */
  windowUploader?: (turnId: string) => (window: Blob) => Promise<void>;
  onUserGesture?: () => void;
  disabled?: boolean;
}

type RecorderState = "idle" | "recording" | "stopped";

/** Where the audio-thread processor is served from. */
const WORKLET_URL = "/worklets/capture-processor.js";

/**
 * How much audio is converted at once.
 *
 * The unit of memory: at 48 kHz stereo float32, five seconds is about 1.9 MiB
 * regardless of how long the answer runs. Shorter windows would put an
 * anti-aliasing filter transient at every join; longer ones hold more audio than a
 * sentence needs.
 */
const WINDOW_SECONDS = 5;

/**
 * Encode float samples as 16-bit little-endian PCM.
 *
 * The two halves are scaled differently — a negative sample by 0x8000 and a
 * positive one by 0x7fff — so that -1 and 1 are both representable in two's
 * complement.
 */
function toPcm16(samples: Float32Array): Uint8Array {
  const bytes = new Uint8Array(samples.length * 2);
  const view = new DataView(bytes.buffer);

  for (let index = 0; index < samples.length; index++) {
    const sample = Math.max(-1, Math.min(1, samples[index]));
    view.setInt16(index * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
  }

  return bytes;
}

/**
 * Convert one window of captured audio into the form the capture is sent in.
 *
 * The resampling is `OfflineAudioContext`'s — the platform's own filtered resampler.
 * Keeping every third sample of a 48 kHz capture instead would fold everything above
 * 8 kHz back down into the speech band as aliasing, and the file a session keeps is
 * this one: there is no wide-band original left to go back to.
 *
 * The destination has one channel, so the source's channels are mixed down by the
 * graph rather than by hand — the platform's own downmix, which halves each side
 * instead of summing them and clipping.
 */
async function renderWindow(blocks: Float32Array[][], sourceRate: number): Promise<Uint8Array> {
  const channelCount = Math.max(1, blocks[0]?.length ?? 1);
  const frameCount = blocks.reduce((total, block) => total + (block[0]?.length ?? 0), 0);

  if (frameCount === 0) return new Uint8Array(0);

  const source = new AudioBuffer({
    length: frameCount,
    sampleRate: sourceRate,
    numberOfChannels: channelCount,
  });

  for (let channel = 0; channel < channelCount; channel++) {
    const samples = new Float32Array(frameCount);
    let offset = 0;
    for (const block of blocks) {
      const data = block[channel];
      if (!data) continue;
      samples.set(data, offset);
      offset += data.length;
    }
    source.copyToChannel(samples, channel);
  }

  // At least one frame, so an empty window is still a buffer that can be rendered.
  const frames = Math.max(1, Math.ceil((frameCount / sourceRate) * CAPTURE_SAMPLE_RATE));
  const context = new OfflineAudioContext(CAPTURE_CHANNELS, frames, CAPTURE_SAMPLE_RATE);
  const node = context.createBufferSource();
  node.buffer = source;
  node.connect(context.destination);
  node.start();

  return toPcm16((await context.startRendering()).getChannelData(0));
}

export default function AudioRecorder({
  onRecordingComplete,
  windowUploader,
  onUserGesture,
  disabled,
}: AudioRecorderProps) {
  const t = useTranslations("voice");
  const [state, setState] = useState<RecorderState>("idle");
  const [durationMs, setDurationMs] = useState(0);
  const [waveform, setWaveform] = useState<number[]>(new Array(40).fill(0));
  const [converting, setConverting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);
  const recordedBlobRef = useRef<Blob | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const workletRef = useRef<AudioWorkletNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const startTimeRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /**
   * The recording, in the form it will be sent: every window already converted, and
   * nothing else held. This is the only audio the client keeps.
   */
  const framesRef = useRef<Uint8Array[]>([]);
  /** Blocks captured but not yet converted — at most one window's worth. */
  const blocksRef = useRef<Float32Array[][]>([]);
  const pendingFramesRef = useRef(0);
  /**
   * Windows are converted one at a time, in order. The chain is what keeps the
   * memory bound true: a second conversion cannot start while the first is still
   * holding its decoded buffer.
   */
  const convertChainRef = useRef<Promise<void>>(Promise.resolve());
  const conversionFailedRef = useRef(false);
  /** Which half failed, so the alert says which rather than "the recording". */
  const failureKindRef = useRef<"convert" | "upload" | null>(null);
  const recordingRef = useRef(false);
  /** The turn this recording is being sent under, when windowed ingestion is on. */
  const turnIdRef = useRef<string | undefined>(undefined);
  /** How a converted window reaches the platform; undefined on the whole-body path. */
  const uploadWindowRef = useRef<((window: Blob) => Promise<void>) | undefined>(undefined);

  const cleanup = useCallback(() => {
    recordingRef.current = false;

    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (workletRef.current) {
      workletRef.current.port.onmessage = null;
      workletRef.current.disconnect();
      workletRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    analyserRef.current = null;
    blocksRef.current = [];
    pendingFramesRef.current = 0;
  }, []);

  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  /**
   * Convert whatever has been captured since the last window and queue it behind
   * the windows already converting.
   */
  const flushWindow = useCallback(() => {
    const blocks = blocksRef.current;
    if (blocks.length === 0 || pendingFramesRef.current === 0) return;

    blocksRef.current = [];
    pendingFramesRef.current = 0;
    const sourceRate = audioContextRef.current?.sampleRate ?? 48_000;

    convertChainRef.current = convertChainRef.current.then(async () => {
      let frame: Uint8Array;
      try {
        frame = await renderWindow(blocks, sourceRate);
      } catch (err) {
        // Converted by the browser, so this is Web Audio refusing the window
        // rather than the platform refusing it — worth naming separately.
        console.error("Window conversion failed:", err);
        conversionFailedRef.current = true;
        failureKindRef.current = "convert";
        return;
      }

      framesRef.current.push(frame);

      // Sent from the same frame the recording is assembled from, and awaited
      // before the next window is converted: the windows on the wire are the
      // recording, in order, with at most one upload in flight.
      if (uploadWindowRef.current) {
        try {
          await uploadWindowRef.current(assembleCapture([frame]));
        } catch (err) {
          // The uploader has already retried once; this is the second refusal.
          console.error("Window upload failed:", err);
          conversionFailedRef.current = true;
          failureKindRef.current = "upload";
        }
      }
    });
  }, []);

  const startRecording = async () => {
    if (disabled) return;
    onUserGesture?.();
    setIsSubmitting(false);
    isSubmittingRef.current = false;

    framesRef.current = [];
    blocksRef.current = [];
    pendingFramesRef.current = 0;
    convertChainRef.current = Promise.resolve();
    conversionFailedRef.current = false;
    failureKindRef.current = null;
    recordedBlobRef.current = null;

    // One id per recording, invented here because this is the moment the first
    // window can be sent; the turn that ends the recording names it.
    turnIdRef.current = windowUploader ? crypto.randomUUID() : undefined;
    uploadWindowRef.current =
      windowUploader && turnIdRef.current ? windowUploader(turnIdRef.current) : undefined;

    try {
      const audioContext = new AudioContext();
      // The samples cannot be had without a worklet, and there is no fallback that
      // keeps this recording's cost bounded — refusing is the honest answer rather
      // than recording in a way this change exists to remove.
      if (!audioContext.audioWorklet) {
        await audioContext.close();
        alert(t("recorderUnsupported"));
        return;
      }

      await audioContext.audioWorklet.addModule(WORKLET_URL);
      audioContextRef.current = audioContext;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const source = audioContext.createMediaStreamSource(stream);

      const worklet = new AudioWorkletNode(audioContext, "capture-processor");
      workletRef.current = worklet;

      const sourceRate = audioContext.sampleRate;
      worklet.port.onmessage = (event: MessageEvent<Float32Array[]>) => {
        if (!recordingRef.current) return;

        const channels = event.data;
        const frames = channels[0]?.length ?? 0;
        blocksRef.current.push(channels);
        pendingFramesRef.current += frames;

        if (pendingFramesRef.current >= sourceRate * WINDOW_SECONDS) {
          flushWindow();
        }
      };

      source.connect(worklet);

      // A node whose output goes nowhere is not guaranteed to be pulled by the
      // graph, so it is connected to the destination through silence.
      const silence = audioContext.createGain();
      silence.gain.value = 0;
      worklet.connect(silence);
      silence.connect(audioContext.destination);

      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 128;
      source.connect(analyser);
      analyserRef.current = analyser;

      recordingRef.current = true;
      startTimeRef.current = Date.now();
      setState("recording");
      setDurationMs(0);

      timerRef.current = setInterval(() => {
        setDurationMs(Date.now() - startTimeRef.current);
      }, 100);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const draw = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        const bars = Array.from({ length: 40 }, (_, i) => {
          const idx = Math.floor((i / 40) * dataArray.length);
          return dataArray[idx] / 255;
        });
        setWaveform(bars);
        rafRef.current = requestAnimationFrame(draw);
      };
      draw();
    } catch (err) {
      console.error("Failed to start recording:", err);
      cleanup();
      alert(t("microphoneError"));
    }
  };

  const stopRecording = () => {
    onUserGesture?.();
    recordingRef.current = false;

    // The clock stops with the recording, not when the last window finishes
    // converting: the duration shown is the one that was spoken.
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    setDurationMs(Date.now() - startTimeRef.current);
    setState("stopped");
    setConverting(true);

    // The tail — whatever was captured since the last window.
    flushWindow();

    void convertChainRef.current.then(() => {
      if (conversionFailedRef.current) {
        cleanup();
        framesRef.current = [];
        recordedBlobRef.current = null;
        setConverting(false);
        setState("idle");
        setDurationMs(0);
        setWaveform(new Array(40).fill(0));
        alert(
          failureKindRef.current === "upload"
            ? t("recordingUploadFailed")
            : t("recordingConvertFailed")
        );
        return;
      }

      recordedBlobRef.current = assembleCapture(framesRef.current);
      framesRef.current = [];
      setConverting(false);
      cleanup();
    });
  };

  const discardRecording = () => {
    cleanup();
    framesRef.current = [];
    recordedBlobRef.current = null;
    turnIdRef.current = undefined;
    uploadWindowRef.current = undefined;
    setState("idle");
    setDurationMs(0);
    setWaveform(new Array(40).fill(0));
    setIsSubmitting(false);
    isSubmittingRef.current = false;
  };

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  };

  return (
    <div className="w-full">
      {state === "idle" && (
        <button
          onClick={startRecording}
          disabled={disabled}
          className="w-full rounded-2xl border-2 border-dashed border-zinc-300 bg-zinc-50 py-8 text-center transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
        >
          <div className="mb-2 text-4xl">🎙️</div>
          <p className="text-base font-medium text-zinc-700 dark:text-zinc-300">
            {t("tapToRecord")}
          </p>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {t("speakClearly")}
          </p>
        </button>
      )}

      {state === "recording" && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mb-4 flex h-16 items-end justify-center gap-0.5">
            {waveform.map((v, i) => (
              <div
                key={i}
                className="w-1.5 rounded-sm bg-zinc-900 transition-all dark:bg-zinc-50"
                style={{
                  height: `${Math.max(4, v * 100)}%`,
                  opacity: 0.3 + v * 0.7,
                }}
              />
            ))}
          </div>

          <p className="mb-4 text-center text-2xl font-mono text-zinc-900 dark:text-zinc-50">
            {formatTime(durationMs)}
          </p>

          <div className="flex justify-center gap-3">
            <button
              onClick={stopRecording}
              className="min-h-[44px] rounded-full bg-red-600 px-6 py-2 text-base font-medium text-white hover:bg-red-700"
            >
              ⏹ {t("stop")}
            </button>
          </div>
        </div>
      )}

      {state === "stopped" && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-center dark:border-zinc-800 dark:bg-zinc-900">
          {converting ? (
            <>
              <div className="mb-3 flex justify-center">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-700 dark:border-t-zinc-50" />
              </div>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {t("convertingWav")}
              </p>
            </>
          ) : (
            <>
              <p className="mb-2 text-sm text-zinc-600 dark:text-zinc-400">
                {t("recordingComplete", { time: formatTime(durationMs) })}
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <button
                  disabled={isSubmitting}
                  onClick={() => {
                    onUserGesture?.();
                    if (isSubmittingRef.current) return;
                    isSubmittingRef.current = true;
                    setIsSubmitting(true);
                    const blob = recordedBlobRef.current;
                    if (blob) {
                      onRecordingComplete(blob, durationMs, turnIdRef.current);
                      recordedBlobRef.current = null; // clear after submit
                    }
                    // Reset to idle so user can record next answer
                    setState("idle");
                    setDurationMs(0);
                    setWaveform(new Array(40).fill(0));
                  }}
                  className="min-h-[44px] rounded-lg bg-zinc-900 px-4 py-2 text-base font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
                >
                  ✓ {t("submitAnswer")}
                </button>
                <button
                  onClick={discardRecording}
                  className="min-h-[44px] rounded-lg border border-zinc-300 px-4 py-2 text-base font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  🗑️ {t("discard")}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
