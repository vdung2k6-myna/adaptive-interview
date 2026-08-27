"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api-client";

interface SetupFormProps {
  positions: { id: string; title: string; level: string }[];
  candidates: { id: string; name: string; email: string }[];
  positionUsage: Map<string, number>;
  candidateUsage: Map<string, number>;
}

export default function SetupForm({
  positions,
  candidates,
  positionUsage,
  candidateUsage,
}: SetupFormProps) {
  const router = useRouter();
  const [positionId, setPositionId] = useState("");
  const [candidateId, setCandidateId] = useState("");
  const [mode, setMode] = useState<"text" | "voice">("text");
  const [ttsProvider, setTtsProvider] = useState<"kokoro" | "piper">("kokoro");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [interviewUrl, setInterviewUrl] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setInterviewUrl("");

    if (!positionId || !candidateId) {
      setError("Please select both a position and a candidate.");
      return;
    }

    setLoading(true);

    try {
      const res = await apiFetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ positionId, candidateId, mode, ttsProvider }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to create session");
      }

      const session = await res.json();
      const interviewPath = mode === "voice" ? `/interview/${session.id}/voice` : `/interview/${session.id}`;
      const url = `${window.location.origin}${interviewPath}`;
      setInterviewUrl(url);

      // Optionally redirect after a short delay
      setTimeout(() => {
        router.push(interviewPath);
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto mt-6 md:mt-12 p-4 md:p-6 rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h1 className="text-2xl font-semibold mb-6 text-zinc-900 dark:text-zinc-50">
        Start Interview Session
      </h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            Position
          </label>
          <select
            value={positionId}
            onChange={(e) => setPositionId(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-base min-h-[44px] text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
          >
            <option value="">Select a position...</option>
            {positions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title} — {p.level}
              </option>
            ))}
          </select>
          {positionId && (positionUsage.get(positionId) || 0) === 0 && (
            <a
              href={`/positions/${positionId}/edit`}
              className="mt-1 inline-block text-xs text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50 underline"
            >
              Edit position
            </a>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            Candidate
          </label>
          <select
            value={candidateId}
            onChange={(e) => setCandidateId(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-base min-h-[44px] text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
          >
            <option value="">Select a candidate...</option>
            {candidates.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.email})
              </option>
            ))}
          </select>
          {candidateId && (candidateUsage.get(candidateId) || 0) === 0 && (
            <a
              href={`/candidates/${candidateId}/edit`}
              className="mt-1 inline-block text-xs text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50 underline"
            >
              Edit candidate
            </a>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            Interview Mode
          </label>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setMode("text")}
              className={`flex-1 min-h-[44px] inline-flex items-center justify-center rounded-lg border px-3 py-2 text-base text-center transition-colors ${
                mode === "text"
                  ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-50 dark:bg-zinc-50 dark:text-zinc-900"
                  : "border-zinc-300 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              }`}
            >
              💬 Text
            </button>
            <button
              type="button"
              onClick={() => setMode("voice")}
              className={`flex-1 min-h-[44px] inline-flex items-center justify-center rounded-lg border px-3 py-2 text-base text-center transition-colors ${
                mode === "voice"
                  ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-50 dark:bg-zinc-50 dark:text-zinc-900"
                  : "border-zinc-300 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              }`}
            >
              🎙️ Voice
            </button>
          </div>
          {mode === "voice" && (
            <div className="mt-2 space-y-2">
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Voice Engine
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setTtsProvider("kokoro")}
                  className={`flex-1 min-h-[44px] inline-flex items-center justify-center rounded-lg border px-3 py-1.5 text-sm text-center transition-colors ${
                    ttsProvider === "kokoro"
                      ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-50 dark:bg-zinc-50 dark:text-zinc-900"
                      : "border-zinc-300 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  }`}
                >
                  🎵 Kokoro
                </button>
                <button
                  type="button"
                  onClick={() => setTtsProvider("piper")}
                  className={`flex-1 min-h-[44px] inline-flex items-center justify-center rounded-lg border px-3 py-1.5 text-sm text-center transition-colors ${
                    ttsProvider === "piper"
                      ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-50 dark:bg-zinc-50 dark:text-zinc-900"
                      : "border-zinc-300 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  }`}
                >
                  🔊 Piper
                </button>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Requires audio.cpp (STT) and audio gateway (TTS) running locally.
              </p>
            </div>
          )}
        </div>

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}

        <div className="flex gap-4 text-sm">
          <a
            href="/positions/new"
            className="min-h-[44px] inline-flex items-center text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50 underline underline-offset-2"
          >
            + New Position
          </a>
          <a
            href="/candidates/new"
            className="min-h-[44px] inline-flex items-center text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50 underline underline-offset-2"
          >
            + New Candidate
          </a>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full min-h-[44px] rounded-lg bg-zinc-900 px-4 py-2 text-base text-white font-medium hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {loading ? "Creating..." : "Create Interview Session"}
        </button>
      </form>

      {interviewUrl && (
        <div className="mt-6 p-4 rounded-lg bg-zinc-50 border border-zinc-200 dark:bg-zinc-800 dark:border-zinc-700">
          <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
            Interview created! Redirecting in 2 seconds...
          </p>
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={interviewUrl}
              className="flex-1 rounded-md border border-zinc-300 px-2 py-1.5 text-base min-h-[44px] text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(interviewUrl)}
              className="min-h-[44px] rounded-md border border-zinc-300 px-3 py-1.5 text-base font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-700"
            >
              Copy
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
