"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";

interface AudioRecorderProps {
  onRecordingComplete: (blob: Blob, durationMs: number) => void;
  onUserGesture?: () => void;
  disabled?: boolean;
}

type RecorderState = "idle" | "recording" | "stopped";

const MIME_TYPE = typeof window !== "undefined" && MediaRecorder.isTypeSupported("audio/webm")
  ? "audio/webm"
  : "audio/wav";

/**
 * Convert an audio Blob to WAV format using the Web Audio API.
 * audio.cpp only accepts WAV for STT transcription.
 */
async function convertToWav(blob: Blob): Promise<Blob> {
  const arrayBuffer = await blob.arrayBuffer();
  const audioContext = new AudioContext();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  audioContext.close();

  const numberOfChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numberOfChannels * bytesPerSample;

  const length = audioBuffer.length * numberOfChannels * bytesPerSample + 44;
  const buffer = new ArrayBuffer(length);
  const view = new DataView(buffer);

  /* RIFF identifier */
  writeString(view, 0, "RIFF");
  /* RIFF chunk length */
  view.setUint32(4, 36 + audioBuffer.length * numberOfChannels * bytesPerSample, true);
  /* RIFF type */
  writeString(view, 8, "WAVE");
  /* format chunk identifier */
  writeString(view, 12, "fmt ");
  /* format chunk length */
  view.setUint32(16, 16, true);
  /* sample format (raw) */
  view.setUint16(20, format, true);
  /* channel count */
  view.setUint16(22, numberOfChannels, true);
  /* sample rate */
  view.setUint32(24, sampleRate, true);
  /* byte rate */
  view.setUint32(28, sampleRate * blockAlign, true);
  /* block align */
  view.setUint16(32, blockAlign, true);
  /* bits per sample */
  view.setUint16(34, bitDepth, true);
  /* data chunk identifier */
  writeString(view, 36, "data");
  /* data chunk length */
  view.setUint32(40, audioBuffer.length * numberOfChannels * bytesPerSample, true);

  // Write interleaved PCM data
  const dataOffset = 44;
  const channels: Float32Array[] = [];
  for (let i = 0; i < numberOfChannels; i++) {
    channels.push(audioBuffer.getChannelData(i));
  }

  let offset = dataOffset;
  for (let i = 0; i < audioBuffer.length; i++) {
    for (let ch = 0; ch < numberOfChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, channels[ch][i]));
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(offset, intSample, true);
      offset += 2;
    }
  }

  return new Blob([buffer], { type: "audio/wav" });
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

export default function AudioRecorder({ onRecordingComplete, onUserGesture, disabled }: AudioRecorderProps) {
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

        // Convert webm → wav for reliable STT compatibility
        setConverting(true);
        try {
          const wavBlob = await convertToWav(blob);
          recordedBlobRef.current = wavBlob;
        } catch (err) {
          console.error("WAV conversion failed:", err);
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
      alert("Could not access microphone. Please check permissions.");
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
            Tap to start recording
          </p>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Speak clearly and concisely
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
              ⏹ Stop
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
                Converting to WAV...
              </p>
            </>
          ) : (
            <>
              <p className="mb-2 text-sm text-zinc-600 dark:text-zinc-400">
                Recording complete ({formatTime(durationMs)})
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
                  ✓ Submit Answer
                </button>
                <button
                  onClick={discardRecording}
                  className="min-h-[44px] rounded-lg border border-zinc-300 px-4 py-2 text-base font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  🗑️ Discard
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
