"use client";

import React from "react";

export interface AudioQueueItem {
  audioUrl: string | null;
  text: string;
  index: number;
}

interface StreamingAudioQueueProps {
  items: AudioQueueItem[];
  currentIndex: number;
  isPlaying: boolean;
  hasError: boolean;
  onPause?: () => void;
  onResume?: (url: string) => void;
}

/**
 * Presentation-only sequential audio queue for sentence-level streaming TTS.
 *
 * Playback is driven imperatively by a parent `SentenceAudioQueue` instance.
 * This component only renders the UI — progress bar, current text, and controls.
 */
export default function StreamingAudioQueue({
  items,
  currentIndex,
  isPlaying,
  hasError,
  onPause,
  onResume,
}: StreamingAudioQueueProps) {
  const currentItem = currentIndex >= 0 ? items[currentIndex] : undefined;

  if (!currentItem) {
    return null;
  }

  const progressText =
    items.length > 1
      ? `Playing ${currentIndex + 1} of ${items.length}`
      : "Playing";

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
          🤖 Interviewer
        </span>
        <span className="text-xs text-zinc-400 dark:text-zinc-500">
          {progressText}
        </span>
      </div>

      {/* Progress bar */}
      <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
        <div
          className="h-full rounded-full bg-zinc-900 transition-all duration-300 dark:bg-zinc-50"
          style={{
            width: `${items.length > 0 ? ((currentIndex + 1) / items.length) * 100 : 0}%`,
          }}
        />
      </div>

      {/* Current sentence text */}
      <div className="mb-3 text-sm text-zinc-800 dark:text-zinc-200">
        {currentItem.text}
      </div>

      {/* Playback controls */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => {
            if (isPlaying) {
              onPause?.();
            } else if (currentItem.audioUrl) {
              onResume?.(currentItem.audioUrl);
            }
          }}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {isPlaying ? "⏸" : "▶"}
        </button>

        {hasError && (
          <span className="text-xs text-amber-600 dark:text-amber-400">
            Audio unavailable for this sentence
          </span>
        )}
      </div>
    </div>
  );
}
