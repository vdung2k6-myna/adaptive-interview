"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api-client";
import type { Campaign } from "@/lib/types";
import DeleteButton from "@/components/DeleteButton";

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch("/api/campaigns")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: Campaign[]) => setCampaigns(data))
      .catch(() => setError("Failed to load campaigns"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-6">
        <div className="mx-auto max-w-5xl">
          <p className="text-zinc-500 dark:text-zinc-400">Loading campaigns...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-6">
        <div className="mx-auto max-w-5xl">
          <p className="text-red-600 dark:text-red-400">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50 underline"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-6">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Campaigns</h1>
          <Link
            href="/campaigns/new"
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            + New Campaign
          </Link>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-800">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-zinc-700 dark:text-zinc-300">Name</th>
                <th className="px-4 py-3 text-left font-medium text-zinc-700 dark:text-zinc-300">Status</th>
                <th className="px-4 py-3 text-left font-medium text-zinc-700 dark:text-zinc-300">Positions</th>
                <th className="px-4 py-3 text-left font-medium text-zinc-700 dark:text-zinc-300">Sessions</th>
                <th className="px-4 py-3 text-left font-medium text-zinc-700 dark:text-zinc-300">Dates</th>
                <th className="px-4 py-3 text-right font-medium text-zinc-700 dark:text-zinc-300">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {campaigns.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-zinc-500 dark:text-zinc-400">
                    No campaigns yet.{" "}
                    <Link href="/campaigns/new" className="underline">Create one</Link>.
                  </td>
                </tr>
              ) : (
                campaigns.map((c) => {
                  const posCount = c.positionCount || 0;
                  const sessCount = c.sessionCount || 0;
                  const dateStr =
                    c.startDate && c.endDate
                      ? `${new Date(c.startDate).toLocaleDateString()} – ${new Date(c.endDate).toLocaleDateString()}`
                      : c.startDate
                        ? `From ${new Date(c.startDate).toLocaleDateString()}`
                        : c.endDate
                          ? `Until ${new Date(c.endDate).toLocaleDateString()}`
                          : "—";
                  const statusColor =
                    c.status === "active"
                      ? "text-emerald-600 dark:text-emerald-400"
                      : c.status === "archived"
                        ? "text-zinc-500 dark:text-zinc-400"
                        : "text-amber-600 dark:text-amber-400";

                  return (
                    <tr key={c.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                      <td className="px-4 py-3 text-zinc-900 dark:text-zinc-50 font-medium">
                        <Link href={`/campaigns/${c.id}`} className="hover:underline">
                          {c.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium uppercase tracking-wide ${statusColor}`}>{c.status}</span>
                      </td>
                      <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{posCount}</td>
                      <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{sessCount}</td>
                      <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{dateStr}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <Link
                            href={`/campaigns/${c.id}`}
                            className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50 underline"
                          >
                            View
                          </Link>
                          <DeleteButton
                            id={c.id}
                            type="campaign"
                            onDelete={() => setCampaigns((prev) => prev.filter((item) => item.id !== c.id))}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
