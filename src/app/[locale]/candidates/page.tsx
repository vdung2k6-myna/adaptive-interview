"use client";

import { useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/lib/api-client";
import type { Candidate } from "@/lib/types";
import DeleteButton from "@/components/DeleteButton";

export default function CandidatesPage() {
  const t = useTranslations("candidates");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch("/api/candidates")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: Candidate[]) => setCandidates(data))
      .catch(() => setError(t("failedLoad")))
      .finally(() => setLoading(false));
  }, [t]);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 p-4 dark:bg-zinc-950 md:p-6">
        <div className="mx-auto max-w-5xl">
          <p className="text-zinc-500 dark:text-zinc-400">{t("loading")}</p>
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
            {t("retry")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 p-4 dark:bg-zinc-950 md:p-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 sm:text-2xl">{t("title")}</h1>
          <Link
            href="/candidates/new"
            className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {t("newCandidate")}
          </Link>
        </div>

        {/* Desktop Table */}
        <div className="hidden overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 md:block">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-800">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-zinc-700 dark:text-zinc-300">{t("name")}</th>
                <th className="px-4 py-3 text-left font-medium text-zinc-700 dark:text-zinc-300">{t("email")}</th>
                <th className="px-4 py-3 text-left font-medium text-zinc-700 dark:text-zinc-300">{t("skills")}</th>
                <th className="px-4 py-3 text-left font-medium text-zinc-700 dark:text-zinc-300">{t("inUse")}</th>
                <th className="px-4 py-3 text-right font-medium text-zinc-700 dark:text-zinc-300">{t("actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {candidates.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-zinc-500 dark:text-zinc-400">
                    {t("noCandidates")}{" "}
                    <Link href="/candidates/new" className="underline">{t("createOne")}</Link>.
                  </td>
                </tr>
              ) : (
                candidates.map((c) => {
                  const inUse = c.sessionCount || 0;
                  const canEdit = inUse === 0;
                  return (
                    <tr key={c.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                      <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-50">{c.name}</td>
                      <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{c.email}</td>
                      <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                        <div className="flex flex-wrap gap-1">
                          {c.skills.slice(0, 5).map((s) => (
                            <span
                              key={s}
                              className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                            >
                              {s}
                            </span>
                          ))}
                          {c.skills.length > 5 && (
                            <span className="text-xs text-zinc-400">+{c.skills.length - 5}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                        {inUse > 0 ? (
                          <span className="text-amber-600 dark:text-amber-400">{inUse} {t("sessions")}</span>
                        ) : (
                          <span className="text-zinc-400">{t("unused")}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-3">
                          {canEdit ? (
                            <>
                              <Link
                                href={`/candidates/${c.id}/edit`}
                                className="min-h-[44px] px-2 text-sm text-zinc-600 underline hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
                              >
                                {t("edit")}
                              </Link>
                              <DeleteButton
                                id={c.id}
                                type="candidate"
                                onDelete={() => setCandidates((prev) => prev.filter((item) => item.id !== c.id))}
                              />
                            </>
                          ) : (
                            <span className="text-xs text-zinc-400 dark:text-zinc-500">{t("inUse")}</span>
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
          {candidates.length === 0 ? (
            <p className="text-center text-zinc-500 dark:text-zinc-400">
              {t("noCandidates")}{" "}
              <Link href="/candidates/new" className="underline">{t("createOne")}</Link>.
            </p>
          ) : (
            candidates.map((c) => {
              const inUse = c.sessionCount || 0;
              const canEdit = inUse === 0;
              return (
                <div
                  key={c.id}
                  className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <div className="mb-3 flex items-start justify-between">
                    <div>
                      <div className="font-medium text-zinc-900 dark:text-zinc-50">{c.name}</div>
                      <div className="text-sm text-zinc-500 dark:text-zinc-400">{c.email}</div>
                    </div>
                    <div className="text-sm text-zinc-600 dark:text-zinc-400">
                      {inUse > 0 ? (
                        <span className="text-amber-600 dark:text-amber-400">{inUse} {t("sessions")}</span>
                      ) : (
                        <span className="text-zinc-400">{t("unused")}</span>
                      )}
                    </div>
                  </div>

                  <div className="mb-4 flex flex-wrap gap-1">
                    {c.skills.slice(0, 5).map((s) => (
                      <span
                        key={s}
                        className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                      >
                        {s}
                      </span>
                    ))}
                    {c.skills.length > 5 && (
                      <span className="text-xs text-zinc-400">+{c.skills.length - 5}</span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-3 border-t border-zinc-200 pt-3 dark:border-zinc-800">
                    {canEdit ? (
                      <>
                        <Link
                          href={`/candidates/${c.id}/edit`}
                          className="min-h-[44px] px-2 text-sm text-zinc-600 underline hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
                        >
                          {t("edit")}
                        </Link>
                        <DeleteButton
                          id={c.id}
                          type="candidate"
                          onDelete={() => setCandidates((prev) => prev.filter((item) => item.id !== c.id))}
                        />
                      </>
                    ) : (
                      <span className="text-xs text-zinc-400 dark:text-zinc-500">{t("inUse")}</span>
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
