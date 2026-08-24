import { useState, useEffect } from "react";

const STORAGE_KEY = "adaptive-interview-playback-rate";
const DEFAULT_PLAYBACK_RATE = 1.0;
const VALID_RATES = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

function isValidRate(value: number): boolean {
  return VALID_RATES.includes(value);
}

function readStoredRate(): number {
  if (typeof window === "undefined") return DEFAULT_PLAYBACK_RATE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? parseFloat(raw) : NaN;
    if (isValidRate(parsed)) return parsed;
  } catch {
    // localStorage may be unavailable (private mode, sandbox)
  }
  return DEFAULT_PLAYBACK_RATE;
}

function writeStoredRate(rate: number): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, String(rate));
  } catch {
    // ignore write failures
  }
}

/**
 * Persistent playback-rate preference for AI voice playback.
 *
 * Defaults to 1.0x (normal speed). Valid options are 0.5, 0.75, 1.0, 1.25, 1.5, 2.0.
 * Persists to localStorage when changed.
 */
export function usePlaybackRate(): [number, (rate: number) => void] {
  const [rate, setRateInternal] = useState<number>(readStoredRate);

  const setRate = (next: number) => {
    const normalized = isValidRate(next) ? next : DEFAULT_PLAYBACK_RATE;
    setRateInternal(normalized);
  };

  useEffect(() => {
    writeStoredRate(rate);
  }, [rate]);

  return [rate, setRate];
}

export { DEFAULT_PLAYBACK_RATE, VALID_RATES };
