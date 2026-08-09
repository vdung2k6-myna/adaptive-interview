"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ positionId, candidateId }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to create session");
      }

      const session = await res.json();
      const url = `${window.location.origin}/interview/${session.id}`;
      setInterviewUrl(url);

      // Optionally redirect after a short delay
      setTimeout(() => {
        router.push(`/interview/${session.id}`);
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto mt-12 p-6 rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
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
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
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
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
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

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}

        <div className="flex gap-4 text-sm">
          <a
            href="/positions/new"
            className="text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50 underline underline-offset-2"
          >
            + New Position
          </a>
          <a
            href="/candidates/new"
            className="text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50 underline underline-offset-2"
          >
            + New Candidate
          </a>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-zinc-900 px-4 py-2 text-white font-medium hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
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
              className="flex-1 rounded-md border border-zinc-300 px-2 py-1 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(interviewUrl)}
              className="rounded-md border border-zinc-300 px-3 py-1 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-700"
            >
              Copy
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
