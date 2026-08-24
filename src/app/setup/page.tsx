"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import type { Candidate, Position, InterviewSession } from "@/lib/types";
import SetupForm from "./SetupForm";

export default function SetupPage() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [sessions, setSessions] = useState<InterviewSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      apiFetch("/api/positions").then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      }),
      apiFetch("/api/candidates").then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      }),
      apiFetch("/api/sessions").then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      }),
    ])
      .then(([posData, candData, sessData]) => {
        setPositions(posData);
        setCandidates(candData);
        setSessions(sessData);
      })
      .catch(() => setError("Failed to load setup data"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen p-8 bg-zinc-50 dark:bg-zinc-950">
        <p className="text-zinc-500 dark:text-zinc-400">Loading setup data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen p-8 bg-zinc-50 dark:bg-zinc-950">
        <p className="text-red-600 dark:text-red-400">{error}</p>
      </div>
    );
  }

  // Compute usage counts from sessions
  const positionSessionCounts = sessions.filter((s) => s.positionId);
  const candidateSessionCounts = sessions.filter((s) => s.candidateId);

  const positionUsage = new Map<string, number>();
  for (const s of positionSessionCounts) {
    positionUsage.set(s.positionId, (positionUsage.get(s.positionId) || 0) + 1);
  }

  const candidateUsage = new Map<string, number>();
  for (const s of candidateSessionCounts) {
    candidateUsage.set(s.candidateId, (candidateUsage.get(s.candidateId) || 0) + 1);
  }

  return (
    <div className="min-h-screen p-8 bg-zinc-50 dark:bg-zinc-950">
      <SetupForm
        positions={positions}
        candidates={candidates}
        positionUsage={positionUsage}
        candidateUsage={candidateUsage}
      />
    </div>
  );
}
