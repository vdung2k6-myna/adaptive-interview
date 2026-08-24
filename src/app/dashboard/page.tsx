"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api-client";

interface Session {
  id: string;
  status: string;
  mode: string;
  maxTurns: number;
  currentTurn: number;
  createdAt: string;
  completedAt: string | null;
  candidate: { id: string; name: string; email: string } | null;
  position: { id: string; title: string; level: string } | null;
  evaluation: {
    overallScore: number | null;
    humanOverallScore: number | null;
    recommendation: string | null;
    humanCalibrated: boolean;
  } | null;
}

export default function DashboardPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    fetchSessions();
  }, []);

  async function fetchSessions() {
    try {
      const res = await apiFetch("/api/sessions");
      if (!res.ok) throw new Error("Failed to fetch sessions");
      const data: Session[] = await res.json();
      setSessions(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  const filteredSessions = useMemo(() => {
    return sessions.filter((s) => {
      const matchesStatus = !statusFilter || s.status === statusFilter;
      const matchesSearch =
        !searchQuery ||
        s.candidate?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.candidate?.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.position?.title.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }, [sessions, statusFilter, searchQuery]);

  const stats = useMemo(() => {
    const total = sessions.length;
    const active = sessions.filter((s) => s.status === "in_progress").length;
    const complete = sessions.filter((s) => s.status === "completed").length;
    const scoredSessions = sessions.filter((s) => s.evaluation?.overallScore !== null);
    const avgScore =
      scoredSessions.length > 0
        ? Math.round(
            (scoredSessions.reduce((sum, s) => sum + (s.evaluation?.overallScore || 0), 0) /
              scoredSessions.length) *
              10
          ) / 10
        : null;
    return { total, active, complete, avgScore };
  }, [sessions]);

  function statusBadge(status: string) {
    const classes: Record<string, string> = {
      created: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
      in_progress: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200",
      completed: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200",
    };
    return (
      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${classes[status] || classes.created}`}>
        {status.replace("_", " ")}
      </span>
    );
  }

  function modeBadge(mode: string) {
    const classes: Record<string, string> = {
      text: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
      voice: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-200",
    };
    return (
      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${classes[mode] || classes.text}`}>
        {mode === "voice" ? "🎙️ Voice" : "💬 Text"}
      </span>
    );
  }

  async function copyInterviewLink(sessionId: string) {
    const url = `${window.location.origin}/interview/${sessionId}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(sessionId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Fallback for older browsers or denied permissions
      const textarea = document.createElement("textarea");
      textarea.value = url;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopiedId(sessionId);
      setTimeout(() => setCopiedId(null), 2000);
    }
  }

  function recommendationBadge(rec: string | null) {
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
        <p className="text-zinc-600 dark:text-zinc-400">Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-6">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50 mb-6">Interview Dashboard</h1>

        {error && (
          <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[
            { label: "Total Sessions", value: stats.total },
            { label: "Active", value: stats.active },
            { label: "Completed", value: stats.complete },
            { label: "Avg Score", value: stats.avgScore ?? "—" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <p className="text-sm text-zinc-500 dark:text-zinc-400">{stat.label}</p>
              <p className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
          >
            <option value="">All Statuses</option>
            <option value="created">Created</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
          </select>
          <input
            type="text"
            placeholder="Search candidate or position..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
          />
        </div>

        {/* Sessions Table */}
        <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-800">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-zinc-700 dark:text-zinc-300">Candidate</th>
                <th className="px-4 py-3 text-left font-medium text-zinc-700 dark:text-zinc-300">Position</th>
                <th className="px-4 py-3 text-left font-medium text-zinc-700 dark:text-zinc-300">Status</th>
                <th className="px-4 py-3 text-left font-medium text-zinc-700 dark:text-zinc-300">Turns</th>
                <th className="px-4 py-3 text-left font-medium text-zinc-700 dark:text-zinc-300">Score</th>
                <th className="px-4 py-3 text-left font-medium text-zinc-700 dark:text-zinc-300">Recommendation</th>
                <th className="px-4 py-3 text-right font-medium text-zinc-700 dark:text-zinc-300">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {filteredSessions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-zinc-500 dark:text-zinc-400">
                    No sessions found.
                  </td>
                </tr>
              ) : (
                filteredSessions.map((s) => (
                  <tr key={s.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-zinc-900 dark:text-zinc-50">{s.candidate?.name || "Unknown"}</div>
                      <div className="text-xs text-zinc-500 dark:text-zinc-400">{s.candidate?.email}</div>
                    </td>
                    <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                      {s.position?.title || "Unknown"} — {s.position?.level}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {statusBadge(s.status)}
                        {modeBadge(s.mode)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                      {s.currentTurn}/{s.maxTurns}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-zinc-700 dark:text-zinc-300">
                        {s.evaluation?.overallScore ?? "—"}
                      </div>
                      {s.evaluation?.humanCalibrated && (
                        <div className="text-xs text-emerald-600 dark:text-emerald-400">
                          Human: {s.evaluation.humanOverallScore ?? "—"}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {recommendationBadge(s.evaluation?.recommendation || null)}
                        {s.evaluation?.humanCalibrated && (
                          <span className="text-xs text-emerald-600 dark:text-emerald-400">✓</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <button
                          onClick={() => copyInterviewLink(s.id)}
                          className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50 underline"
                        >
                          {copiedId === s.id ? "Copied!" : "Copy Link"}
                        </button>
                        {s.mode === "voice" && s.status !== "completed" && (
                          <Link
                            href={`/interview/${s.id}/voice`}
                            className="text-sm text-purple-600 hover:text-purple-900 dark:text-purple-400 dark:hover:text-purple-200 underline"
                          >
                            Join Voice
                          </Link>
                        )}
                        <Link
                          href={`/interview/${s.id}/transcript`}
                          className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50 underline"
                        >
                          View
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
