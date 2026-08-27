"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api-client";
import type { Position } from "@/lib/types";
import DeleteButton from "@/components/DeleteButton";

export default function PositionsPage() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch("/api/positions")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: Position[]) => setPositions(data))
      .catch(() => setError("Failed to load positions"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 p-4 dark:bg-zinc-950 md:p-6">
        <div className="mx-auto max-w-5xl">
          <p className="text-zinc-500 dark:text-zinc-400">Loading positions...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-zinc-50 p-4 dark:bg-zinc-950 md:p-6">
        <div className="mx-auto max-w-5xl">
          <p className="text-red-600 dark:text-red-400">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 min-h-[44px] text-sm text-zinc-600 underline hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 p-4 dark:bg-zinc-950 md:p-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 sm:text-2xl">Positions</h1>
          <Link
            href="/positions/new"
            className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            + New Position
          </Link>
        </div>

        {/* Desktop Table */}
        <div className="hidden overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 md:block">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-800">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-zinc-700 dark:text-zinc-300">Title</th>
                <th className="px-4 py-3 text-left font-medium text-zinc-700 dark:text-zinc-300">Level</th>
                <th className="px-4 py-3 text-left font-medium text-zinc-700 dark:text-zinc-300">Description</th>
                <th className="px-4 py-3 text-left font-medium text-zinc-700 dark:text-zinc-300">Requirements</th>
                <th className="px-4 py-3 text-left font-medium text-zinc-700 dark:text-zinc-300">In Use</th>
                <th className="px-4 py-3 text-right font-medium text-zinc-700 dark:text-zinc-300">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {positions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-zinc-500 dark:text-zinc-400">
                    No positions yet.{" "}
                    <Link href="/positions/new" className="underline">Create one</Link>.
                  </td>
                </tr>
              ) : (
                positions.map((p) => {
                  const inUse = p.sessionCount || 0;
                  const canEdit = inUse === 0;
                  return (
                    <tr key={p.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                      <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-50">{p.title}</td>
                      <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{p.level}</td>
                      <td className="max-w-xs truncate px-4 py-3 text-zinc-600 dark:text-zinc-400">{p.jobDescription || "—"}</td>
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
                      <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                        {inUse > 0 ? (
                          <span className="text-amber-600 dark:text-amber-400">{inUse} session{inUse > 1 ? "s" : ""}</span>
                        ) : (
                          <span className="text-zinc-400">Unused</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-3">
                          {canEdit ? (
                            <>
                              <Link
                                href={`/positions/${p.id}/edit`}
                                className="min-h-[44px] px-2 text-sm text-zinc-600 underline hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
                              >
                                Edit
                              </Link>
                              <DeleteButton
                                id={p.id}
                                type="position"
                                onDelete={() => setPositions((prev) => prev.filter((item) => item.id !== p.id))}
                              />
                            </>
                          ) : (
                            <span className="text-xs text-zinc-400 dark:text-zinc-500">In use</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards */}
        <div className="space-y-3 md:hidden">
          {positions.length === 0 ? (
            <p className="text-center text-zinc-500 dark:text-zinc-400">
              No positions yet.{" "}
              <Link href="/positions/new" className="underline">Create one</Link>.
            </p>
          ) : (
            positions.map((p) => {
              const inUse = p.sessionCount || 0;
              const canEdit = inUse === 0;
              return (
                <div
                  key={p.id}
                  className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <div className="mb-3 flex items-start justify-between">
                    <div>
                      <div className="font-medium text-zinc-900 dark:text-zinc-50">{p.title}</div>
                      <div className="text-sm text-zinc-500 dark:text-zinc-400">{p.level}</div>
                    </div>
                    <div className="text-sm text-zinc-600 dark:text-zinc-400">
                      {inUse > 0 ? (
                        <span className="text-amber-600 dark:text-amber-400">{inUse} session{inUse > 1 ? "s" : ""}</span>
                      ) : (
                        <span className="text-zinc-400">Unused</span>
                      )}
                    </div>
                  </div>

                  <p className="mb-3 text-sm text-zinc-600 dark:text-zinc-400">{p.jobDescription || "—"}</p>

                  <div className="mb-4 flex flex-wrap gap-1">
                    {p.requirements.map((r) => (
                      <span
                        key={r}
                        className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                      >
                        {r}
                      </span>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center gap-3 border-t border-zinc-200 pt-3 dark:border-zinc-800">
                    {canEdit ? (
                      <>
                        <Link
                          href={`/positions/${p.id}/edit`}
                          className="min-h-[44px] px-2 text-sm text-zinc-600 underline hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
                        >
                          Edit
                        </Link>
                        <DeleteButton
                          id={p.id}
                          type="position"
                          onDelete={() => setPositions((prev) => prev.filter((item) => item.id !== p.id))}
                        />
                      </>
                    ) : (
                      <span className="text-xs text-zinc-400 dark:text-zinc-500">In use</span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
