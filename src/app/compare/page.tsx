"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api-client";

interface Message {
  id: string;
  role: "interviewer" | "candidate";
  content: string;
  createdAt: string;
}

interface AiScores {
  technicalDepth: number | null;
  communicationClarity: number | null;
  problemSolving: number | null;
  relevanceToRole: number | null;
}

interface HumanScores {
  technicalDepth: number | null;
  communicationClarity: number | null;
  problemSolving: number | null;
  relevanceToRole: number | null;
}

interface Evaluation {
  id: string;
  model: string;
  aiScores: AiScores;
  humanScores: HumanScores;
  aiRecommendation: string | null;
  humanRecommendation: string | null;
  humanCalibrated: boolean;
  confidence: number | null;
  strengths: string[];
  weaknesses: string[];
}

interface SessionData {
  session: {
    id: string;
    status: string;
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
  messages: Message[];
  evaluation: Evaluation | null;
}

function CompareContent() {
  const searchParams = useSearchParams();
  const sessionIds = [
    searchParams.get("a") || "",
    searchParams.get("b") || "",
  ].filter(Boolean);

  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (sessionIds.length === 0) {
      setLoading(false);
      return;
    }
    fetchSessions();
  }, []);

  async function fetchSessions() {
    try {
      const results = await Promise.all(
        sessionIds.map(async (id) => {
          const [sessionRes, evalRes] = await Promise.all([
            apiFetch(`/api/sessions/${id}`),
            apiFetch(`/api/evaluations/${id}`).catch(() => null),
          ]);

          if (!sessionRes.ok) throw new Error(`Failed to load session ${id}`);
          const sessionData = await sessionRes.json();

          let evaluation = null;
          if (evalRes && evalRes.ok) {
            const evalData = await evalRes.json();
            evaluation = evalData.latest || null;
          }

          return { ...sessionData, evaluation };
        })
      );
      setSessions(results);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load sessions");
    } finally {
      setLoading(false);
    }
  }

  function StarDisplay({ score }: { score: number | null }) {
    if (score === null) return <span className="text-zinc-400">—</span>;
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <span key={n} className={`text-sm ${n <= score ? "text-yellow-500" : "text-zinc-300 dark:text-zinc-600"}`}>
            ★
          </span>
        ))}
        <span className="ml-1 text-xs text-zinc-600 dark:text-zinc-400">{score}/5</span>
      </div>
    );
  }

  function RecBadge({ rec }: { rec: string | null }) {
    if (!rec) return <span className="text-zinc-400">—</span>;
    const colors: Record<string, string> = {
      strong_yes: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      yes: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
      maybe: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
      no: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
      strong_no: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    };
    return (
      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${colors[rec] || colors.maybe}`}>
        {rec.replace("_", " ")}
      </span>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <p className="text-zinc-600 dark:text-zinc-400">Loading comparison...</p>
      </div>
    );
  }

  if (sessionIds.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="text-center">
          <p className="text-zinc-600 dark:text-zinc-400 mb-4">Select two sessions to compare.</p>
          <Link href="/dashboard" className="text-zinc-900 dark:text-zinc-50 underline">
            Go to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-6">
      <div className="mx-auto max-w-5xl">
        <Link href="/dashboard" className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50 mb-4 inline-block">
          ← Back to Dashboard
        </Link>

        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50 mb-6">Candidate Comparison</h1>

        {error && (
          <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
        )}

        {sessions.length >= 2 && (
          <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 dark:bg-zinc-800">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-zinc-700 dark:text-zinc-300">Metric</th>
                  {sessions.map((s) => (
                    <th key={s.session.id} className="px-4 py-3 text-left font-medium text-zinc-700 dark:text-zinc-300">
                      <div>{s.candidate?.name || "Unknown"}</div>
                      <div className="text-xs text-zinc-500 dark:text-zinc-400">{s.candidate?.email}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                <tr>
                  <td className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">Model</td>
                  {sessions.map((s) => (
                    <td key={s.session.id} className="px-4 py-3">
                      <span className="inline-flex items-center rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                        🤖 {s.evaluation?.model || "—"}
                      </span>
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">Technical Depth</td>
                  {sessions.map((s) => (
                    <td key={s.session.id} className="px-4 py-3">
                      <StarDisplay score={s.evaluation?.aiScores.technicalDepth ?? null} />
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">Communication</td>
                  {sessions.map((s) => (
                    <td key={s.session.id} className="px-4 py-3">
                      <StarDisplay score={s.evaluation?.aiScores.communicationClarity ?? null} />
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">Problem Solving</td>
                  {sessions.map((s) => (
                    <td key={s.session.id} className="px-4 py-3">
                      <StarDisplay score={s.evaluation?.aiScores.problemSolving ?? null} />
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">Relevance</td>
                  {sessions.map((s) => (
                    <td key={s.session.id} className="px-4 py-3">
                      <StarDisplay score={s.evaluation?.aiScores.relevanceToRole ?? null} />
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">AI Recommendation</td>
                  {sessions.map((s) => (
                    <td key={s.session.id} className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <RecBadge rec={s.evaluation?.aiRecommendation || null} />
                        {s.evaluation?.humanCalibrated && (
                          <span className="text-xs text-emerald-600 dark:text-emerald-400">✓ Calibrated</span>
                        )}
                      </div>
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">Confidence</td>
                  {sessions.map((s) => (
                    <td key={s.session.id} className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                      {s.evaluation?.confidence ?? "—"}%
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">Actions</td>
                  {sessions.map((s) => (
                    <td key={s.session.id} className="px-4 py-3">
                      <Link
                        href={`/interview/${s.session.id}/transcript`}
                        className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50 underline"
                      >
                        View Transcript
                      </Link>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ComparePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <p className="text-zinc-600 dark:text-zinc-400">Loading comparison...</p>
      </div>
    }>
      <CompareContent />
    </Suspense>
  );
}
