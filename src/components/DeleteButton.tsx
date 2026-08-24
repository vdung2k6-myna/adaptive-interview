"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api-client";

interface DeleteButtonProps {
  id: string;
  type: "position" | "candidate" | "campaign";
  onDelete?: () => void;
}

export default function DeleteButton({ id, type, onDelete }: DeleteButtonProps) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm(`Are you sure you want to delete this ${type}?`)) return;
    setDeleting(true);

    try {
      let endpoint: string;
      if (type === "position") {
        endpoint = `/api/positions/${id}`;
      } else if (type === "candidate") {
        endpoint = `/api/candidates/${id}`;
      } else {
        endpoint = `/api/campaigns/${id}`;
      }
      const res = await apiFetch(endpoint, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Failed to delete");
        return;
      }
      onDelete?.();
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={deleting}
      className="text-sm text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 underline disabled:opacity-50"
    >
      {deleting ? "Deleting..." : "Delete"}
    </button>
  );
}
