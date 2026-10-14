"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { useTranslations } from "next-intl";
import { encodeWav } from "@/lib/audio/capture-format";
import { paceOf, type AnswerPace } from "@/lib/audio/answer-pacing";

interface AudioRecorderProps {
  onRecordingComplete: (blob: Blob, durationMs: number) => void;
  onUserGesture?: () => void;
  disabled?: boolean;
}

type RecorderState = "idle" | "recording" | "stopped";

/** What the display says as an answer passes each mark of the length the interviewer asked for. */
const PACE_MESSAGE: Record<AnswerPace, string> = {
  short: "answerPaceShort",
  expected: "answerPaceExpected",
  long: "answerPaceLong",
};

/** How it says it. The words carry the meaning; the tone only makes it legible at a glance, and
 *  `short` is the quiet one because there is nothing to say yet. */
const PACE_TONE: Record<AnswerPace, string> = {
  short: "text-zinc-500 dark:text-zinc-400",
  expected: "text-emerald-600 dark:text-emerald-400",
  long: "text-amber-600 dark:text-amber-400",
};

/**
 * What the browser records into on its way to being re-encoded.
 *
 * This does not decide what is uploaded: every recording is decoded, narrowed to one channel at
 * 16 kHz and re-encoded as WAV before it is sent, so the choice here only affects the intermediate
 * blob and never reaches the wire. See `toNarrowBandWav`.
 */
const MIME_TYPE = typeof window !== "undefined" && MediaRecorder.isTypeSupported("audio/webm")
  ? "audio/webm"
  : "audio/wav";

/** The shape a capture is sent in — the band speech is recognised from, and small enough to fit
 *  the transport. See `toNarrowBandWav`. */
const CAPTURE_SAMPLE_RATE = 16_000;
const CAPTURE_CHANNELS = 1;

/**
 * Decode a recorded Blob and re-encode it as a narrow-band WAV.
 *
 * Two things happen here for two different reasons. The **WAV** is the platform's contract:
 * `transcribeAudio` declares every upload `audio/wav` before it reaches the transcriber, so an
 * uncompressed file is not a fallback but the format that is actually transcribed — and the
 * container the browser recorded in never reaches the wire.
 *
 * The **narrow band** is the transport's. A capture is measured as a request body by the proxy in
 * front of the API, and stereo at the device's rate reaches its 10 MB bound after about a minute
 * of speech. One channel at 16 kHz is the band speech is recognised from and about six times
 * smaller, which puts that bound around 5.5 minutes instead.
 *
 * The resampling is `OfflineAudioContext`'s — the platform's own filtered resampler. Keeping every
 * third sample of a 48 kHz capture instead would fold everything above 8 kHz back down into the
 * speech band as aliasing, and the file a session keeps is this one: there is no wide-band
 * original left to go back to.
 */
async function toNarrowBandWav(blob: Blob): Promise<Blob> {
  const arrayBuffer = await blob.arrayBuffer();
  const decodingContext = new AudioContext();
  const decoded = await decodingContext.decodeAudioData(arrayBuffer);
  decodingContext.close();

  // At least one frame, so an empty capture is still a buffer that can be rendered.
  const frames = Math.max(1, Math.ceil(decoded.duration * CAPTURE_SAMPLE_RATE));
  const narrowBand = new OfflineAudioContext(CAPTURE_CHANNELS, frames, CAPTURE_SAMPLE_RATE);

  const source = narrowBand.createBufferSource();
  source.buffer = decoded;
  // The destination has one channel, so the source's are mixed down to it by the graph rather
  // than by hand — the platform's own downmix, which halves each side instead of summing them
  // and clipping.
  source.connect(narrowBand.destination);
  source.start();

  return encodeWav(await narrowBand.startRendering());
}

export default function AudioRecorder({ onRecordingComplete, onUserGesture, disabled }: AudioRecorderProps) {
  const t = useTranslations("voice");
  const [state, setState] = useState<RecorderState>("idle");
  const [durationMs, setDurationMs] = useState(0);
  const [waveform, setWaveform] = useState<number[]>(new Array(40).fill(0));
  const [converting, setConverting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);
  const recordedBlobRef = useRef<Blob | null>(null); // Stores converted WAV blob after stop

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const cleanup = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    mediaRecorderRef.current = null;
    analyserRef.current = null;
  }, []);

  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  const startRecording = async () => {
    if (disabled) return;
    onUserGesture?.();
    setIsSubmitting(false);
    isSubmittingRef.current = false;

    try {
      chunksRef.current = [];
      recordedBlobRef.current = null;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream, { mimeType: MIME_TYPE });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: MIME_TYPE });
        const duration = Date.now() - startTimeRef.current;
        setDurationMs(duration);

        // Narrow the capture to what the platform transcribes and what the transport will carry,
        // before it is stored for submission. The duration above is the one measured while
        // recording: the resampled buffer is shorter in frames, and it is not what was spoken.
        setConverting(true);
        try {
          const wavBlob = await toNarrowBandWav(blob);
          recordedBlobRef.current = wavBlob;
        } catch (err) {
          console.error("Narrow-band conversion failed:", err);
          // Fallback: store original blob
          recordedBlobRef.current = blob;
        } finally {
          setConverting(false);
          cleanup();
        }
      };

      // Set up audio visualization
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 128;
      source.connect(analyser);
      analyserRef.current = analyser;

      mediaRecorder.start(100); // collect every 100ms
      startTimeRef.current = Date.now();
      setState("recording");
      setDurationMs(0);

      // Timer
      timerRef.current = setInterval(() => {
        setDurationMs(Date.now() - startTimeRef.current);
      }, 100);

      // Waveform animation
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
      alert(t("microphoneError"));
    }
  };

  const stopRecording = () => {
    onUserGesture?.();
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    setState("stopped");
  };

  const discardRecording = () => {
    cleanup();
    recordedBlobRef.current = null;
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

  /** Where this answer stands against what the interviewer asked for. Read, never acted on:
   *  nothing below this line stops a recording, disables a control, or bounds how long a person
   *  may speak — the expectation is shown so they can pace themselves, and the decision stays
   *  theirs. See the `answer-pacing` capability. */
  const pace = paceOf(durationMs);

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

          <div className="mb-4 text-center">
            <p
              className={`text-2xl font-mono ${
                pace === "long"
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-zinc-900 dark:text-zinc-50"
              }`}
            >
              {formatTime(durationMs)}
            </p>
            {/* The clock, and the length that was asked for, together while the person is still
                speaking — so they can pace themselves without the platform having to say anything. */}
            <p className={`mt-1 text-sm ${PACE_TONE[pace]}`}>{t(PACE_MESSAGE[pace])}</p>
          </div>

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
                      onRecordingComplete(blob, durationMs);
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
