"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/lib/api-client";

interface DeleteButtonProps {
  id: string;
  type: "position" | "candidate" | "campaign";
  onDelete?: () => void;
}

export default function DeleteButton({ id, type, onDelete }: DeleteButtonProps) {
  const router = useRouter();
  const tCommon = useTranslations("common");
  const tErrors = useTranslations("errors");
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm(tErrors("confirmDelete", { type }))) return;
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
        alert(data.error || tCommon("unknown"));
        return;
      }
      onDelete?.();
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : tCommon("unknown"));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={deleting}
      className="min-h-[44px] px-2 text-sm text-red-600 underline hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 disabled:opacity-50"
    >
      {deleting ? tCommon("deleting") : tCommon("delete")}
    </button>
  );
}
