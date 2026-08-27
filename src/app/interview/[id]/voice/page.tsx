"use client";

export const dynamic = "force-dynamic";

import React, { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import AudioRecorder from "@/components/AudioRecorder";
import AudioPlayer from "@/components/AudioPlayer";
import StreamingAudioQueue, {
  type AudioQueueItem,
} from "@/components/StreamingAudioQueue";
import { SentenceAudioQueue } from "@/lib/audio/sentence-queue";
import { apiFetch } from "@/lib/api-client";
import { usePlaybackRate } from "@/lib/use-playback-rate";

interface VoiceMessage {
  id: string;
  role: "interviewer" | "candidate";
  content: string;
  audioUrl: string | null;
  createdAt: string;
}

interface SessionData {
  session: {
    id: string;
    status: string;
    mode: string;
    language: "english" | "vietnamese";
    maxTurns: number;
    currentTurn: number;
  };
  candidate: {
    name: string;
    email: string;
  } | null;
  position: {
    title: string;
    level: string;
  } | null;
  messages: VoiceMessage[];
}

interface SentenceEvent {
  index: number;
  text: string;
  audioUrl: string | null;
}

interface DoneEvent {
  session: {
    status: string;
    currentTurn: number;
    maxTurns: number;
  };
  messageId: string;
  fullText?: string;
  audioUrl?: string | null;
}

interface CandidateEvent {
  text: string;
  audioUrl: string;
  confidence: number | null;
  messageId: string;
}

export default function VoiceInterviewPage() {
  const params = useParams();
  const sessionId = params.id as string;

  const [data, setData] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [processing, setProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState("");
  const [useStreaming, setUseStreaming] = useState(true);
  const [streamFallback, setStreamFallback] = useState(false);
  const [interviewStarted, setInterviewStarted] = useState(false);
  const [playbackRate, setPlaybackRate] = usePlaybackRate();

  // Sentence-level audio queue for the current streaming response
  const [streamItems, setStreamItems] = useState<AudioQueueItem[]>([]);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const lastInterviewerMsgRef = useRef<VoiceMessage | undefined>(undefined);
  const playbackRateRef = useRef(playbackRate);

  useEffect(() => {
    playbackRateRef.current = playbackRate;
  }, [playbackRate]);

  // Guard against duplicate SSE events and stale-closure fallback
  const hasReceivedSentencesRef = useRef(false);
  const seenSentenceIndicesRef = useRef(new Set<number>());

  // Reorder buffer: holds chunks that arrived out-of-order until all
  // previous indices are ready, ensuring playback always starts from 0.
  const pendingChunksRef = useRef<
    Map<number, { audioUrl: string; text: string }>
  >(new Map());
  const nextExpectedIndexRef = useRef(0);

  // Imperative audio queue for instant sentence-level playback.
  // Created inside the user-gesture handler so AudioContext is valid.
  const sentenceQueueRef = useRef<SentenceAudioQueue | null>(null);

  // Per-turn generation counter and abort controller. A new recording
  // invalidates any still-running SSE reader from the previous turn so stale
  // chunks cannot leak into the new sentence queue.
  const turnGenerationRef = useRef(0);
  const turnAbortRef = useRef<AbortController | null>(null);

  // UI state driven by the queue callbacks
  const [queueCurrentIndex, setQueueCurrentIndex] = useState(-1);
  const [queueIsPlaying, setQueueIsPlaying] = useState(false);
  const [queueHasError, setQueueHasError] = useState(false);

  async function fetchSession() {
    try {
      const res = await apiFetch(`/api/sessions/${sessionId}`);
      if (!res.ok) {
        throw new Error("Failed to load session");
      }
      const sessionData: SessionData = await res.json();

      if (sessionData.session.mode !== "voice") {
        throw new Error("This session is not in voice mode");
      }

      setData(sessionData);

      // If no messages yet, user will click "Start Interview" button
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function startInterview(): Promise<VoiceMessage | null> {
    setProcessing(true);
    setProcessingStep("Generating first question...");
    setError("");

    try {
      const res = await apiFetch("/api/voice/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to start interview");
      }

      const result = await res.json();
      const interviewerMessage = result.interviewerMessage as VoiceMessage;
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          messages: [interviewerMessage],
          session: { ...prev.session, ...result.session },
        };
      });
      return interviewerMessage;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      return null;
    } finally {
      setProcessing(false);
      setProcessingStep("");
    }
  }

  async function handleStartInterview() {
    // Create AudioContext on user gesture so auto-play works for
    // subsequent audio. Must happen inside the click handler.
    if (!audioCtxRef.current) {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (Ctx) {
        audioCtxRef.current = new Ctx();
      }
    }
    if (audioCtxRef.current?.state === "suspended") {
      try {
        await audioCtxRef.current.resume();
      } catch {
        // ignore
      }
    }

    // Set up a sentence queue now, inside the user gesture, so the first
    // question can auto-play without relying on the <audio> element's
    // stricter autoplay policy.
    if (sentenceQueueRef.current) {
      sentenceQueueRef.current.stop();
    }
    if (audioCtxRef.current) {
      sentenceQueueRef.current = new SentenceAudioQueue(audioCtxRef.current, {
        playbackRate,
        onStart: (index) => {
          setQueueCurrentIndex(index);
          setQueueIsPlaying(true);
          setQueueHasError(false);
        },
        onEnd: () => {
          // UI updates handled by onStart of next item or onFinished
        },
        onError: () => {
          setQueueHasError(true);
          setQueueIsPlaying(false);
        },
        onFinished: () => {
          setQueueIsPlaying(false);
          setQueueCurrentIndex(-1);
          setTimeout(() => {
            setStreamItems([]);
          }, 2000);
        },
      });
    }

    setInterviewStarted(true);
    const firstMessage = await startInterview();

    if (firstMessage?.audioUrl && sentenceQueueRef.current) {
      sentenceQueueRef.current.enqueue(0, firstMessage.audioUrl, firstMessage.content);
    }
  }

  // Fallback to non-streaming turn endpoint
  async function handleTurnFallback(blob: Blob) {
    const formData = new FormData();
    formData.append("sessionId", sessionId);
    formData.append("audio", blob, "recording.wav");

    try {
      const res = await apiFetch("/api/voice/turn", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const responseData = await res.json().catch(() => ({}));
        throw new Error(responseData.error || "Failed to process turn");
      }

      const result = await res.json();

      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          messages: [
            ...prev.messages,
            result.candidateMessage,
            result.interviewerMessage,
          ],
          session: { ...prev.session, ...result.session },
        };
      });

      // Auto-play interviewer audio using the sentence queue that was created
      // inside the user gesture in handleRecordingComplete.
      if (result.interviewerMessage.audioUrl && sentenceQueueRef.current) {
        sentenceQueueRef.current.enqueue(
          0,
          result.interviewerMessage.audioUrl,
          result.interviewerMessage.content
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setProcessing(false);
      setProcessingStep("");
    }
  }

  async function handleRecordingComplete(blob: Blob, _durationMs: number) {
    void _durationMs;
    if (!data || data.session.status === "completed") return;

    // New turn: invalidate any still-running SSE reader from a previous turn.
    const myGen = ++turnGenerationRef.current;
    if (turnAbortRef.current) {
      turnAbortRef.current.abort();
      turnAbortRef.current = null;
    }

    // Initialize AudioContext on user gesture so auto-play works for
    // subsequent streaming audio. Must happen inside the click handler.
    if (!audioCtxRef.current) {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (Ctx) {
        audioCtxRef.current = new Ctx();
      }
    }
    if (audioCtxRef.current?.state === "suspended") {
      try {
        await audioCtxRef.current.resume();
      } catch {
        // ignore
      }
    }

    // Create sentence queue for this turn (replaces any previous one)
    if (sentenceQueueRef.current) {
      sentenceQueueRef.current.stop();
    }
    if (audioCtxRef.current) {
      sentenceQueueRef.current = new SentenceAudioQueue(audioCtxRef.current, {
        playbackRate,
        onStart: (index) => {
          setQueueCurrentIndex(index);
          setQueueIsPlaying(true);
          setQueueHasError(false);
        },
        onEnd: () => {
          // UI updates handled by onStart of next item or onFinished
        },
        onError: () => {
          setQueueHasError(true);
          setQueueIsPlaying(false);
        },
        onFinished: () => {
          setQueueIsPlaying(false);
          setQueueCurrentIndex(-1);
          setTimeout(() => {
            setStreamItems([]);
          }, 2000);
        },
      });
    }

    setProcessing(true);
    setProcessingStep("Transcribing your answer...");
    setError("");
    setStreamItems([]);
    setStreamFallback(false);
    setQueueCurrentIndex(-1);
    setQueueIsPlaying(false);
    setQueueHasError(false);

    // Reset per-turn guards and clear any lingering fallback audio
    hasReceivedSentencesRef.current = false;
    seenSentenceIndicesRef.current.clear();
    pendingChunksRef.current.clear();
    nextExpectedIndexRef.current = 0;
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current.src = "";
      audioPlayerRef.current.load();
    }

    if (!useStreaming) {
      await handleTurnFallback(blob);
      return;
    }

    const formData = new FormData();
    formData.append("sessionId", sessionId);
    formData.append("audio", blob, "recording.wav");

    const turnAbortCtrl = new AbortController();
    turnAbortRef.current = turnAbortCtrl;

    try {
      // Direct backend URL to bypass Next.js dev proxy buffering.
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";
      const res = await apiFetch(`${backendUrl}/api/voice/stream`, {
        method: "POST",
        body: formData,
        signal: turnAbortCtrl.signal,
      });

      if (!res.ok || !res.body) {
        console.warn("[VoiceInterview] SSE failed, falling back to /api/voice/turn");
        setStreamFallback(true);
        await handleTurnFallback(blob);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        if (myGen !== turnGenerationRef.current) {
          await reader.cancel();
          break;
        }

        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Parse SSE events from buffer
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const eventBlock of lines) {
          if (!eventBlock.trim()) continue;

          const eventLine = eventBlock.split("\n").find((l) => l.startsWith("event:"));
          const dataLine = eventBlock.split("\n").find((l) => l.startsWith("data:"));

          if (!eventLine || !dataLine) continue;

          const eventName = eventLine.replace("event:", "").trim();
          const payload = dataLine.replace("data:", "").trim();

          try {
            const parsed = JSON.parse(payload);

            switch (eventName) {
              case "candidate": {
                if (myGen !== turnGenerationRef.current) break;
                const c = parsed as CandidateEvent;
                setData((prev) => {
                  if (!prev) return prev;
                  const candidateMsg: VoiceMessage = {
                    id: c.messageId || `candidate-${Date.now()}`,
                    role: "candidate",
                    content: c.text,
                    audioUrl: c.audioUrl,
                    createdAt: new Date().toISOString(),
                  };
                  return {
                    ...prev,
                    messages: [...prev.messages, candidateMsg],
                  };
                });
                setProcessingStep("Interviewer is thinking...");
                break;
              }

              case "sentence": {
                if (myGen !== turnGenerationRef.current) break;
                const s = parsed as SentenceEvent;
                if (seenSentenceIndicesRef.current.has(s.index)) {
                  console.warn(
                    `[VoiceInterview] Duplicate sentence event ignored: index=${s.index}`
                  );
                  break;
                }
                seenSentenceIndicesRef.current.add(s.index);
                hasReceivedSentencesRef.current = true;
                setStreamItems((prev) => [
                  ...prev,
                  { index: s.index, text: s.text, audioUrl: s.audioUrl },
                ]);
                // Buffer chunk; flush will enqueue in strict index order
                if (s.audioUrl) {
                  pendingChunksRef.current.set(s.index, {
                    audioUrl: s.audioUrl,
                    text: s.text,
                  });
                } else {
                  // TTS failed — mark as skipped
                  pendingChunksRef.current.set(s.index, {
                    audioUrl: "",
                    text: s.text,
                  });
                }
                // Flush contiguous chunks starting from nextExpectedIndex
                if (sentenceQueueRef.current) {
                  let idx = nextExpectedIndexRef.current;
                  while (pendingChunksRef.current.has(idx)) {
                    const chunk = pendingChunksRef.current.get(idx)!;
                    if (chunk.audioUrl) {
                      sentenceQueueRef.current.enqueue(idx, chunk.audioUrl, chunk.text);
                    }
                    pendingChunksRef.current.delete(idx);
                    idx++;
                  }
                  nextExpectedIndexRef.current = idx;
                }
                setProcessingStep("Generating voice...");
                break;
              }

              case "done": {
                if (myGen !== turnGenerationRef.current) break;
                const d = parsed as DoneEvent;
                setProcessing(false);
                setProcessingStep("");

                setData((prev) => {
                  if (!prev) return prev;

                  // Add interviewer message with full audio
                  const interviewerMsg: VoiceMessage = {
                    id: d.messageId || `interviewer-${Date.now()}`,
                    role: "interviewer",
                    content: d.fullText || "",
                    audioUrl: d.audioUrl || null,
                    createdAt: new Date().toISOString(),
                  };

                  return {
                    ...prev,
                    messages: [...prev.messages, interviewerMsg],
                    session: { ...prev.session, ...d.session },
                  };
                });
                break;
              }

              case "error": {
                if (myGen !== turnGenerationRef.current) break;
                console.error("[VoiceInterview] SSE error event:", parsed);
                // If we already received some sentences, show them; otherwise fallback
                if (!hasReceivedSentencesRef.current) {
                  setStreamFallback(true);
                  await handleTurnFallback(blob);
                  return;
                } else {
                  setError(parsed.message || "Streaming error occurred");
                  setProcessing(false);
                  setProcessingStep("");
                }
                break;
              }
            }
          } catch {
            // Skip malformed SSE data
          }
        }
      }
    } catch (err) {
      // A newer turn has already started; ignore errors from the stale reader.
      if (myGen !== turnGenerationRef.current) {
        return;
      }

      console.error("[VoiceInterview] SSE connection error:", err);
      if (err instanceof Error && err.name === "AbortError") {
        // Aborted by a newer turn — clean state silently.
        setProcessing(false);
        setProcessingStep("");
        return;
      }
      if (!hasReceivedSentencesRef.current) {
        setStreamFallback(true);
        await handleTurnFallback(blob);
        return;
      } else {
        setError(err instanceof Error ? err.message : "Streaming error");
        setProcessing(false);
        setProcessingStep("");
      }
    } finally {
      if (turnAbortRef.current === turnAbortCtrl) {
        turnAbortRef.current = null;
      }
    }
  }

  useEffect(() => {
    fetchSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 p-4 dark:bg-zinc-950">
        <p className="text-zinc-600 dark:text-zinc-400">Loading voice interview...</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 p-4 dark:bg-zinc-950">
        <div className="text-center">
          <p className="mb-4 text-red-600 dark:text-red-400">{error}</p>
          <button
            onClick={() => {
              setError("");
              setLoading(true);
              fetchSession();
            }}
            className="min-h-[44px] rounded-lg bg-zinc-900 px-4 py-2 text-white dark:bg-zinc-50 dark:text-zinc-900"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const isComplete = data?.session.status === "completed";
  const lastInterviewerMsg = data?.messages
    .filter((m) => m.role === "interviewer")
    .pop();
  lastInterviewerMsgRef.current = lastInterviewerMsg;

  // Show "Start Interview" button if no messages yet and not started
  if (data && data.messages.length === 0 && !isComplete && !interviewStarted) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 p-4 dark:bg-zinc-950">
        <div className="text-center">
          <h1 className="mb-2 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
            {data.position?.title || "Interview"}
          </h1>
          <p className="mb-6 text-sm text-zinc-500 dark:text-zinc-400">
            {data.candidate?.name} · {data.position?.level}
          </p>
          <button
            onClick={handleStartInterview}
            className="min-h-[48px] rounded-lg bg-zinc-900 px-6 py-3 text-base font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            🎙️ Start Interview
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-zinc-950">
      {/* Hidden audio element for fallback auto-play */}
      <audio ref={audioPlayerRef} />

      <header className="border-b border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto max-w-2xl">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-base font-semibold text-zinc-900 dark:text-zinc-50 sm:text-lg">
                {data?.position?.title || "Interview"}
              </h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                {data?.candidate?.name} · {data?.position?.level}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => setUseStreaming((s) => !s)}
                className="min-h-[44px] text-xs text-zinc-500 underline hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                title="Toggle streaming mode"
              >
                {useStreaming ? "🌊 Streaming" : "⏹ Standard"}
              </button>
              <select
                value={playbackRate}
                onChange={(e) => setPlaybackRate(parseFloat(e.target.value))}
                aria-label="Playback speed"
                title="Playback speed"
                className="min-h-[44px] rounded-lg border border-zinc-300 bg-white px-2 py-1 text-base text-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
              >
                <option value={0.5}>0.5x</option>
                <option value={0.75}>0.75x</option>
                <option value={1.0}>1.0x</option>
                <option value={1.25}>1.25x</option>
                <option value={1.5}>1.5x</option>
                <option value={2.0}>2.0x</option>
              </select>
              <div className="text-sm text-zinc-500 dark:text-zinc-400">
                {isComplete ? (
                  <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900 dark:text-green-200">
                    Completed
                  </span>
                ) : (
                  <span>
                    Turn {data?.session.currentTurn ?? 0}/{data?.session.maxTurns ?? 8}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-4 md:py-6">
        <div className="mx-auto max-w-2xl space-y-4">
          {/* Previous messages */}
          {data?.messages.map((msg) => (
            <AudioPlayer
              key={msg.id}
              audioUrl={msg.audioUrl || ""}
              transcript={msg.content}
              role={msg.role}
            />
          ))}

          {/* Streaming audio queue for current response */}
          {streamItems.length > 0 && (
            <StreamingAudioQueue
              items={streamItems}
              currentIndex={queueCurrentIndex}
              isPlaying={queueIsPlaying}
              hasError={queueHasError}
              onPause={() => {
                // Don't suspend the shared AudioContext — on mobile Safari it
                // may never resume without a new user gesture, which breaks
                // auto-play of the next question. Just stop the current item.
                sentenceQueueRef.current?.stop();
                setQueueIsPlaying(false);
              }}
              onResume={() => {
                // Resume only the queue UI state, not the underlying context.
                setQueueIsPlaying(true);
              }}
            />
          )}

          {/* Fallback indicator */}
          {streamFallback && (
            <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
              Streaming unavailable — switched to standard mode.
            </div>
          )}

          {/* Processing indicator */}
          {processing && (
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-center dark:border-zinc-800 dark:bg-zinc-900">
              <div className="mb-3 flex justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-700 dark:border-t-zinc-50"
                />
              </div>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">{processingStep}</p>
            </div>
          )}

          {/* Error */}
          {error && data && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">
              {error}
            </div>
          )}
        </div>
      </main>

      <footer className="border-t border-zinc-200 bg-white px-4 py-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto max-w-2xl">
          {isComplete ? (
            <div className="py-2 text-center">
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Thank you for completing the interview.
              </p>
              <a
                href={`/interview/${sessionId}/transcript`}
                className="mt-2 inline-flex min-h-[44px] items-center justify-center rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                View Transcript
              </a>
            </div>
          ) : (
            <>
              {lastInterviewerMsg && !processing && streamItems.length === 0 && (
                <div className="mb-3 text-center">
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    🤖 Interviewer spoke. Your turn to respond.
                  </p>
                </div>
              )}
              <AudioRecorder
                onRecordingComplete={handleRecordingComplete}
                onUserGesture={() => {
                  // Every recorder interaction is a user gesture: ensure the
                  // shared AudioContext is running so the next question can
                  // auto-play after backend processing.
                  if (!audioCtxRef.current) {
                    const Ctx =
                      window.AudioContext ||
                      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
                    if (Ctx) {
                      audioCtxRef.current = new Ctx();
                    }
                  }
                  if (audioCtxRef.current?.state === "suspended") {
                    audioCtxRef.current.resume().catch(() => {});
                  }
                }}
                disabled={processing}
              />
            </>
          )}
        </div>
      </footer>
    </div>
  );
}
