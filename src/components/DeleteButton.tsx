"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface DeleteButtonProps {
  id: string;
  type: "position" | "candidate" | "campaign";
}

export default function DeleteButton({ id, type }: DeleteButtonProps) {
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
      const res = await fetch(endpoint, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Failed to delete");
        return;
      }
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
