"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/lib/api-client";

interface CandidateFormProps {
  initialData?: {
    id: string;
    name: string;
    email: string;
    skills: string[];
    experienceYears: number | null;
    cv: string | null;
  };
}

export default function CandidateForm({ initialData }: CandidateFormProps) {
  const t = useTranslations("candidates");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const isEditing = !!initialData;

  const [name, setName] = useState(initialData?.name || "");
  const [email, setEmail] = useState(initialData?.email || "");
  const [experienceYears, setExperienceYears] = useState(
    initialData?.experienceYears?.toString() || ""
  );
  const [skill, setSkill] = useState("");
  const [skills, setSkills] = useState<string[]>(initialData?.skills || []);
  const [cv, setCv] = useState(initialData?.cv || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function addSkill(e?: React.FormEvent) {
    if (e) e.preventDefault();
    const trimmed = skill.trim();
    if (!trimmed) return;
    if (skills.includes(trimmed)) {
      setSkill("");
      return;
    }
    setSkills((prev) => [...prev, trimmed]);
    setSkill("");
  }

  function removeSkill(index: number) {
    setSkills((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError(t("nameRequired"));
      return;
    }
    if (!email.trim()) {
      setError(t("emailRequired"));
      return;
    }
    if (skills.length === 0) {
      setError(t("skillsRequired"));
      return;
    }

    setLoading(true);

    try {
      const url = isEditing ? `/api/candidates/${initialData.id}` : "/api/candidates";
      const method = isEditing ? "PATCH" : "POST";

      const res = await apiFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          skills,
          experienceYears: experienceYears ? Number(experienceYears) : null,
          cv: cv.trim() || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `${isEditing ? tCommon("save") : tCommon("create")} failed`);
      }

      router.push(isEditing ? "/candidates" : "/setup");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : tCommon("unknown"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto mt-6 md:mt-12 p-4 md:p-6 rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h1 className="text-2xl font-semibold mb-6 text-zinc-900 dark:text-zinc-50">
        {isEditing ? t("editCandidateTitle") : t("newCandidateTitle")}
      </h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            {t("fullName")}
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("fullNamePlaceholder")}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-base min-h-[44px] text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            {t("email")}
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("emailPlaceholder")}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-base min-h-[44px] text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            {t("experienceYears")}
          </label>
          <input
            type="number"
            min={0}
            value={experienceYears}
            onChange={(e) => setExperienceYears(e.target.value)}
            placeholder="5"
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-base min-h-[44px] text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            {t("skills")}
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={skill}
              onChange={(e) => setSkill(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addSkill();
                }
              }}
              placeholder={t("skillsPlaceholder")}
              className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-base min-h-[44px] text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
            />
            <button
              type="button"
              onClick={() => addSkill()}
              className="min-h-[44px] rounded-lg border border-zinc-300 px-3 py-2 text-base font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-700"
            >
              {t("add")}
            </button>
          </div>

          {skills.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {skills.map((s, i) => (
                <span
                  key={`${s}-${i}`}
                  className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-3 py-1 text-sm text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200"
                >
                  {s}
                  <button
                    type="button"
                    onClick={() => removeSkill(i)}
                    className="inline-flex h-10 w-10 sm:h-6 sm:w-6 flex-shrink-0 items-center justify-center rounded-full text-lg sm:text-sm text-zinc-500 hover:bg-zinc-200 hover:text-zinc-900 dark:hover:bg-zinc-700 dark:hover:text-zinc-50"
                    aria-label={t("removeSkill", { skill: s })}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            {t("cvResume")}
          </label>
          <textarea
            value={cv}
            onChange={(e) => setCv(e.target.value)}
            placeholder={t("cvPlaceholder")}
            rows={8}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-base text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50 resize-y"
          />
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            {t("cvHint")}
          </p>
        </div>

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 min-h-[44px] rounded-lg bg-zinc-900 px-4 py-2 text-base text-white font-medium hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {loading ? t("saving") : isEditing ? t("saveChanges") : t("createCandidate")}
          </button>
          <Link
            href={isEditing ? "/candidates" : "/setup"}
            className="min-h-[44px] inline-flex items-center justify-center rounded-lg border border-zinc-300 px-4 py-2 text-base font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            {t("cancel")}
          </Link>
        </div>
      </form>
    </div>
  );
}
