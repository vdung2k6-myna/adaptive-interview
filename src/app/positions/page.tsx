import { db } from "@/lib/db";
import { positions, interviewSessions } from "@/lib/schema";
import { count } from "drizzle-orm";
import Link from "next/link";
import DeleteButton from "@/components/DeleteButton";

export const dynamic = "force-dynamic";

export default async function PositionsPage() {
  const positionRows = await db.select().from(positions);

  // Count sessions per position
  const sessionCounts = await db
    .select({
      positionId: interviewSessions.positionId,
      count: count(),
    })
    .from(interviewSessions)
    .groupBy(interviewSessions.positionId);

  const countMap = new Map(sessionCounts.map((s) => [s.positionId, s.count]));

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-6">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Positions</h1>
          <Link
            href="/positions/new"
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            + New Position
          </Link>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 overflow-hidden">
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
              {positionRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-zinc-500 dark:text-zinc-400">
                    No positions yet.{" "}
                    <Link href="/positions/new" className="underline">Create one</Link>.
                  </td>
                </tr>
              ) : (
                positionRows.map((p) => {
                  const inUse = countMap.get(p.id) || 0;
                  const canEdit = inUse === 0;
                  return (
                    <tr key={p.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                      <td className="px-4 py-3 text-zinc-900 dark:text-zinc-50 font-medium">{p.title}</td>
                      <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{p.level}</td>
                      <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400 max-w-xs truncate">{p.jobDescription || "—"}</td>
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
                                className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50 underline"
                              >
                                Edit
                              </Link>
                              <DeleteButton id={p.id} type="position" />
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
      </div>
    </div>
  );
}
