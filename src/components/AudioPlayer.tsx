"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";

interface AudioPlayerProps {
  audioUrl: string;
  transcript: string;
  role?: "interviewer" | "candidate";
}

export default function AudioPlayer({ audioUrl, transcript, role = "interviewer" }: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [showTranscript, setShowTranscript] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const isDraggingRef = useRef(isDragging);

  useEffect(() => {
    isDraggingRef.current = isDragging;
  }, [isDragging]);

  // Sync progress from audio time, but skip while user is dragging
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => {
      if (isDraggingRef.current) return; // Don't fight the slider while dragging
      const ct = isFinite(audio.currentTime) ? audio.currentTime : 0;
      const dur = isFinite(audio.duration) ? audio.duration : 0;
      setCurrentTime(ct);
      setProgress(dur > 0 ? (ct / dur) * 100 : 0);
    };

    const onLoadedMetadata = () => {
      setDuration(isFinite(audio.duration) ? audio.duration : 0);
    };

    const onEnded = () => setIsPlaying(false);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
    };
  }, [audioUrl]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
    } else {
      audio.play().catch((err) => {
        console.warn("[AudioPlayer] Playback failed:", err);
      });
    }
  };

  // Called continuously while dragging
  const handleSeekChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    if (!isFinite(val)) return;
    setProgress(val);
  }, []);

  // Called on mouse/touch release — actually seek the audio
  const handleSeekCommit = useCallback(() => {
    const audio = audioRef.current;
    const input = inputRef.current;
    if (!audio || !input || !duration || !isFinite(duration)) {
      setIsDragging(false);
      return;
    }
    const val = parseFloat(input.value);
    if (!isFinite(val)) {
      setIsDragging(false);
      return;
    }
    const newTime = (val / 100) * duration;
    if (isFinite(newTime)) {
      audio.currentTime = newTime;
      setCurrentTime(newTime);
      setProgress(val);
    }
    setIsDragging(false);
  }, [duration]);

  const handleSeekStart = useCallback(() => {
    setIsDragging(true);
  }, []);

  const formatTime = (seconds: number) => {
    if (!isFinite(seconds) || seconds < 0) return "00:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const label = role === "interviewer" ? "🤖 Interviewer" : "👤 You";
  const borderColor = role === "interviewer"
    ? "border-zinc-200 dark:border-zinc-700"
    : "border-zinc-900 dark:border-zinc-500";

  return (
    <div className={`rounded-2xl border ${borderColor} bg-white p-4 dark:bg-zinc-900`}>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{label}</span>
        {audioUrl === "" && (
          <span className="text-xs text-amber-600 dark:text-amber-400">Audio unavailable</span>
        )}
      </div>

      {audioUrl && (
        <>
          <audio ref={audioRef} src={audioUrl} preload="metadata" />

          <div className="flex items-center gap-3">
            <button
              onClick={togglePlay}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {isPlaying ? "⏸" : "▶"}
            </button>

            <div className="flex-1">
              <input
                ref={inputRef}
                type="range"
                min={0}
                max={100}
                step={0.1}
                value={progress}
                onChange={handleSeekChange}
                onMouseDown={handleSeekStart}
                onMouseUp={handleSeekCommit}
                onTouchStart={handleSeekStart}
                onTouchEnd={handleSeekCommit}
                className="w-full accent-zinc-900 dark:accent-zinc-50"
              />
              <div className="mt-1 flex justify-between text-xs text-zinc-500 dark:text-zinc-400">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>
          </div>
        </>
      )}

      <button
        onClick={() => setShowTranscript((s) => !s)}
        className="mt-3 text-xs text-zinc-500 underline hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
      >
        {showTranscript ? "Hide transcript ▲" : "Show transcript ▼"}
      </button>

      {showTranscript && (
        <div className="mt-2 rounded-lg bg-zinc-50 p-3 text-sm text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200">
          {transcript}
        </div>
      )}
    </div>
  );
}
