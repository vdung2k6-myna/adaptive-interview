"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import type { Position } from "@/lib/types";
import CampaignForm from "./CampaignForm";

export default function NewCampaignPage() {
  const [positions, setPositions] = useState<Array<{ id: string; title: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch("/api/positions")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: Position[]) => {
        setPositions(data.map((p) => ({ id: p.id, title: p.title })));
      })
      .catch(() => setError("Failed to load positions"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen p-8 bg-zinc-50 dark:bg-zinc-950">
        <p className="text-zinc-500 dark:text-zinc-400">Loading positions...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen p-8 bg-zinc-50 dark:bg-zinc-950">
        <p className="text-red-600 dark:text-red-400">{error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8 bg-zinc-50 dark:bg-zinc-950">
      <CampaignForm positions={positions} />
    </div>
  );
}
