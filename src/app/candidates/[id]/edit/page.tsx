"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiFetch } from "@/lib/api-client";
import type { Candidate } from "@/lib/types";
import CandidateForm from "../../new/CandidateForm";

export default function EditCandidatePage() {
  const { id } = useParams() as { id: string };
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    apiFetch(`/api/candidates/${id}`)
      .then((r) => {
        if (r.status === 404) throw new Error("Candidate not found");
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: Candidate) => setCandidate(data))
      .catch((err) => setError(err.message || "Failed to load candidate"))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen p-4 md:p-8 bg-zinc-50 dark:bg-zinc-950">
        <p className="text-zinc-500 dark:text-zinc-400">Loading candidate...</p>
      </div>
    );
  }

  if (error || !candidate) {
    return (
      <div className="min-h-screen p-4 md:p-8 bg-zinc-50 dark:bg-zinc-950">
        <p className="text-red-600 dark:text-red-400">{error || "Candidate not found"}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8 bg-zinc-50 dark:bg-zinc-950">
      <CandidateForm
        initialData={{
          id: candidate.id,
          name: candidate.name,
          email: candidate.email,
          skills: candidate.skills,
          experienceYears: candidate.experienceYears,
          cv: candidate.cv,
        }}
      />
    </div>
  );
}
