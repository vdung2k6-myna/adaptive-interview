"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/lib/api-client";

interface CampaignFormProps {
  positions: { id: string; title: string }[];
}

export default function CampaignForm({ positions }: CampaignFormProps) {
  const t = useTranslations("campaigns");
  const tCommon = useTranslations("common");
  const router = useRouter();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [selectedPositions, setSelectedPositions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function addTag(e?: React.FormEvent) {
    if (e) e.preventDefault();
    const trimmed = tagInput.trim();
    if (!trimmed) return;
    if (tags.includes(trimmed)) {
      setTagInput("");
      return;
    }
    setTags((prev) => [...prev, trimmed]);
    setTagInput("");
  }

  function removeTag(index: number) {
    setTags((prev) => prev.filter((_, i) => i !== index));
  }

  function togglePosition(id: string) {
    setSelectedPositions((prev) =>
      prev.includes(id) ? prev.filter((pid) => pid !== id) : [...prev, id]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError(t("nameRequired"));
      return;
    }

    setLoading(true);

    try {
      const res = await apiFetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          tags,
          positionIds: selectedPositions,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || tCommon("failedCreate"));
      }

      router.push("/campaigns");
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
        {t("newCampaignTitle")}
      </h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            {t("name")}
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("namePlaceholder")}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-base min-h-[44px] text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            {t("description")}
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t("descriptionPlaceholder")}
            rows={3}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-base text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              {t("startDate")}
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-base min-h-[44px] text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              {t("endDate")}
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-base min-h-[44px] text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            {t("tags")}
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addTag();
                }
              }}
              placeholder={t("tagsPlaceholder")}
              className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-base min-h-[44px] text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
            />
            <button
              type="button"
              onClick={() => addTag()}
              className="min-h-[44px] rounded-lg border border-zinc-300 px-3 py-2 text-base font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-700"
            >
              {t("add")}
            </button>
          </div>

          {tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {tags.map((tag, i) => (
                <span
                  key={`${tag}-${i}`}
                  className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-3 py-1 text-sm text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(i)}
                    className="inline-flex h-10 w-10 sm:h-6 sm:w-6 flex-shrink-0 items-center justify-center rounded-full text-lg sm:text-sm text-zinc-500 hover:bg-zinc-200 hover:text-zinc-900 dark:hover:bg-zinc-700 dark:hover:text-zinc-50"
                    aria-label={t("removeTag", { tag })}
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
            {t("positions")}
          </label>
          {positions.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {t("noPositionsAvailable")}{" "}
              <Link href="/positions/new" className="underline">
                {t("createOneLink")}
              </Link>
            </p>
          ) : (
            <div className="max-h-48 overflow-y-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
              {positions.map((p) => (
                <label
                  key={p.id}
                  className="flex items-center gap-3 min-h-[44px] px-3 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedPositions.includes(p.id)}
                    onChange={() => togglePosition(p.id)}
                    className="h-5 w-5 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-500 dark:border-zinc-700"
                  />
                  <span className="text-base text-zinc-900 dark:text-zinc-50">{p.title}</span>
                </label>
              ))}
            </div>
          )}
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
            {loading ? t("creating") : t("createCampaign")}
          </button>
          <Link
            href="/campaigns"
            className="min-h-[44px] inline-flex items-center justify-center rounded-lg border border-zinc-300 px-4 py-2 text-base font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            {t("cancel")}
          </Link>
        </div>
      </form>
    </div>
  );
}
