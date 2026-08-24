"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiFetch } from "@/lib/api-client";
import type { Position } from "@/lib/types";
import PositionForm from "../../new/PositionForm";

export default function EditPositionPage() {
  const { id } = useParams() as { id: string };
  const [position, setPosition] = useState<Position | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    apiFetch(`/api/positions/${id}`)
      .then((r) => {
        if (r.status === 404) throw new Error("Position not found");
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: Position) => setPosition(data))
      .catch((err) => setError(err.message || "Failed to load position"))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen p-8 bg-zinc-50 dark:bg-zinc-950">
        <p className="text-zinc-500 dark:text-zinc-400">Loading position...</p>
      </div>
    );
  }

  if (error || !position) {
    return (
      <div className="min-h-screen p-8 bg-zinc-50 dark:bg-zinc-950">
        <p className="text-red-600 dark:text-red-400">{error || "Position not found"}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8 bg-zinc-50 dark:bg-zinc-950">
      <PositionForm
        initialData={{
          id: position.id,
          title: position.title,
          level: position.level,
          jobDescription: position.jobDescription,
          requirements: position.requirements,
        }}
      />
    </div>
  );
}
