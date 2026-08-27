"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api-client";
import type { CampaignDetail } from "@/lib/types";

export default function CampaignDetailPage() {
  const { id } = useParams() as { id: string };
  const [campaign, setCampaign] = useState<CampaignDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    apiFetch(`/api/campaigns/${id}`)
      .then((r) => {
        if (r.status === 404) throw new Error("Campaign not found");
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: CampaignDetail) => setCampaign(data))
      .catch((err) => setError(err.message || "Failed to load campaign"))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 p-4 dark:bg-zinc-950 md:p-6">
        <div className="mx-auto max-w-5xl">
          <p className="text-zinc-500 dark:text-zinc-400">Loading campaign...</p>
        </div>
      </div>
    );
  }

  if (error || !campaign) {
    return (
      <div className="min-h-screen bg-zinc-50 p-4 dark:bg-zinc-950 md:p-6">
        <div className="mx-auto max-w-5xl">
          <p className="text-red-600 dark:text-red-400">{error || "Campaign not found"}</p>
        </div>
      </div>
    );
  }

  const {
    name,
    description,
    status,
    startDate,
    endDate,
    tags,
    positions,
    metrics,
    recommendations,
    topCandidates,
  } = campaign;

  const dateStr =
    startDate && endDate
      ? `${new Date(startDate).toLocaleDateString()} – ${new Date(endDate).toLocaleDateString()}`
      : startDate
        ? `From ${new Date(startDate).toLocaleDateString()}`
        : endDate
          ? `Until ${new Date(endDate).toLocaleDateString()}`
          : "No dates set";

  const statusColor =
    status === "active"
      ? "text-emerald-600 dark:text-emerald-400"
      : status === "archived"
        ? "text-zinc-500 dark:text-zinc-400"
        : "text-amber-600 dark:text-amber-400";

  return (
    <div className="min-h-screen bg-zinc-50 p-4 dark:bg-zinc-950 md:p-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6">
          <Link
            href="/campaigns"
            className="min-h-[44px] text-sm text-zinc-600 underline hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
          >
            ← Back to Campaigns
          </Link>
        </div>

        <div className="mb-6 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 md:p-6">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 sm:text-2xl">{name}</h1>
              {description && <p className="mt-1 text-zinc-600 dark:text-zinc-400">{description}</p>}
            </div>
            <span
              className={`rounded-full bg-zinc-100 px-2 py-1 text-xs font-medium uppercase tracking-wide dark:bg-zinc-800 ${statusColor}`}
            >
              {status}
            </span>
          </div>

          <div className="flex flex-wrap gap-4 text-sm text-zinc-600 dark:text-zinc-400">
            <span>{dateStr}</span>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {tags.map((t) => (
                  <span
                    key={t}
                    className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                  >
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Total Sessions", value: metrics.totalSessions },
            { label: "Completion Rate", value: `${metrics.completionRate}%` },
            { label: "Avg AI Score", value: metrics.avgAiScore ?? "—" },
            { label: "Avg Human Score", value: metrics.avgHumanScore ?? "—" },
          ].map((m) => (
            <div
              key={m.label}
              className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <p className="text-sm text-zinc-500 dark:text-zinc-400">{m.label}</p>
              <p className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{m.value}</p>
            </div>
          ))}
        </div>

        {Object.keys(recommendations).length > 0 && (
          <div className="mb-6 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 md:p-6">
            <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">AI Recommendation Distribution</h2>
            <div className="space-y-3">
              {Object.entries(recommendations).map(([rec, count]) => (
                <div key={rec} className="flex items-center gap-3">
                  <span className="w-24 text-sm text-zinc-700 dark:text-zinc-300 sm:w-32">{rec}</span>
                  <div className="flex-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                    <div
                      className="h-4 rounded-full bg-zinc-900 dark:bg-zinc-50"
                      style={{ width: `${metrics.totalSessions > 0 ? (count / metrics.totalSessions) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="w-8 text-right text-sm text-zinc-600 dark:text-zinc-400">{count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {topCandidates.length > 0 && (
          <div className="mb-6 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 md:p-6">
            <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">Top Candidates</h2>

            <div className="hidden overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-700 md:block">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 dark:bg-zinc-800">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-zinc-700 dark:text-zinc-300">Name</th>
                    <th className="px-4 py-3 text-left font-medium text-zinc-700 dark:text-zinc-300">AI Score</th>
                    <th className="px-4 py-3 text-left font-medium text-zinc-700 dark:text-zinc-300">Human Score</th>
                    <th className="px-4 py-3 text-left font-medium text-zinc-700 dark:text-zinc-300">Recommendation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {topCandidates.map((tc) => (
                    <tr key={tc.sessionId}>
                      <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-50">
                        <Link href={`/interview/${tc.sessionId}`} className="hover:underline">
                          {tc.candidateName}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{tc.aiAvg?.toFixed(1) ?? "—"}</td>
                      <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{tc.humanAvg?.toFixed(1) ?? "—"}</td>
                      <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{tc.recommendation || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-3 md:hidden">
              {topCandidates.map((tc) => (
                <div
                  key={tc.sessionId}
                  className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-700"
                >
                  <div className="mb-2 font-medium text-zinc-900 dark:text-zinc-50">
                    <Link href={`/interview/${tc.sessionId}`} className="hover:underline">
                      {tc.candidateName}
                    </Link>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-zinc-500 dark:text-zinc-400">AI:</span>{" "}
                      {tc.aiAvg?.toFixed(1) ?? "—"}
                    </div>
                    <div>
                      <span className="text-zinc-500 dark:text-zinc-400">Human:</span>{" "}
                      {tc.humanAvg?.toFixed(1) ?? "—"}
                    </div>
                  </div>
                  <div className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                    {tc.recommendation || "—"}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 md:p-6">
          <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">Positions</h2>
          {positions.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">No positions in this campaign.</p>
          ) : (
            <>
              <div className="hidden overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-700 md:block">
                <table className="w-full text-sm">
                  <thead className="bg-zinc-50 dark:bg-zinc-800">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-zinc-700 dark:text-zinc-300">Title</th>
                      <th className="px-4 py-3 text-left font-medium text-zinc-700 dark:text-zinc-300">Level</th>
                      <th className="px-4 py-3 text-left font-medium text-zinc-700 dark:text-zinc-300">Requirements</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                    {positions.map((p) => (
                      <tr key={p.id}>
                        <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-50">
                          <Link href={`/positions/${p.id}/edit`} className="hover:underline">{p.title}</Link>
                        </td>
                        <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{p.level}</td>
                        <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                          <div className="flex flex-wrap gap-1">
                            {p.requirements.map((r) => (
                              <span
                                key={r}
                                className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                              >
                                {r}
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="space-y-3 md:hidden">
                {positions.map((p) => (
                  <div
                    key={p.id}
                    className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-700"
                  >
                    <div className="mb-2 font-medium text-zinc-900 dark:text-zinc-50">
                      <Link href={`/positions/${p.id}/edit`} className="hover:underline">{p.title}</Link>
                    </div>
                    <div className="mb-2 text-sm text-zinc-600 dark:text-zinc-400">{p.level}</div>
                    <div className="flex flex-wrap gap-1">
                      {p.requirements.map((r) => (
                        <span
                          key={r}
                          className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                        >
                          {r}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
