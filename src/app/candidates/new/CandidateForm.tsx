"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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
      setError("Name is required.");
      return;
    }
    if (!email.trim()) {
      setError("Email is required.");
      return;
    }
    if (skills.length === 0) {
      setError("Add at least one skill.");
      return;
    }

    setLoading(true);

    try {
      const url = isEditing ? `/api/candidates/${initialData.id}` : "/api/candidates";
      const method = isEditing ? "PATCH" : "POST";

      const res = await fetch(url, {
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
        throw new Error(data.error || `Failed to ${isEditing ? "update" : "create"} candidate`);
      }

      router.push(isEditing ? "/candidates" : "/setup");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto mt-12 p-6 rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h1 className="text-2xl font-semibold mb-6 text-zinc-900 dark:text-zinc-50">
        {isEditing ? "Edit Candidate" : "New Candidate"}
      </h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            Full Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Jane Doe"
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="jane@example.com"
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            Experience (years)
          </label>
          <input
            type="number"
            min={0}
            value={experienceYears}
            onChange={(e) => setExperienceYears(e.target.value)}
            placeholder="5"
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            Skills
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
              placeholder="e.g. React, Kubernetes, Python"
              className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
            />
            <button
              type="button"
              onClick={() => addSkill()}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-700"
            >
              Add
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
                    className="ml-1 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-50"
                    aria-label={`Remove ${s}`}
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
            CV / Resume
          </label>
          <textarea
            value={cv}
            onChange={(e) => setCv(e.target.value)}
            placeholder="Paste the candidate's CV here..."
            rows={8}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50 resize-y"
          />
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            This will be used to personalize interview questions.
          </p>
        </div>

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 rounded-lg bg-zinc-900 px-4 py-2 text-white font-medium hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {loading ? "Saving..." : isEditing ? "Save Changes" : "Create Candidate"}
          </button>
          <a
            href={isEditing ? "/candidates" : "/setup"}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Cancel
          </a>
        </div>
      </form>
    </div>
  );
}
