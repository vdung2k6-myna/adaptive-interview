"use client";

import React from "react";
import { ModelBadge } from "./ModelBadge";

interface Version {
  id: string;
  model: string;
  humanCalibrated: boolean | null;
  createdAt: string;
}

interface VersionHistoryProps {
  versions: Version[];
  currentVersionId?: string;
  onSelect?: (versionId: string) => void;
  onDelete?: (versionId: string) => void;
}

export const VersionHistory = React.memo(function VersionHistory({
  versions,
  currentVersionId,
  onSelect,
  onDelete,
}: VersionHistoryProps) {
  if (versions.length <= 1) return null;

  return (
    <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-700">
      <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
        Version History
      </p>
      <ul className="space-y-1.5">
        {versions.map((v) => {
          const isCurrent = v.id === currentVersionId;
          return (
            <li
              key={v.id}
              className={`flex min-h-[44px] items-center justify-between rounded-lg px-2 text-sm ${
                isCurrent
                  ? "bg-zinc-100 dark:bg-zinc-800"
                  : "hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
              }`}
            >
              <button
                type="button"
                onClick={() => onSelect?.(v.id)}
                className="flex flex-1 items-center gap-2 text-left"
                disabled={!onSelect}
              >
                <ModelBadge model={v.model} />
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  {new Date(v.createdAt).toLocaleDateString()}
                </span>
                {v.humanCalibrated && (
                  <span className="text-xs text-emerald-600 dark:text-emerald-400">
                    Calibrated
                  </span>
                )}
                {isCurrent && (
                  <span className="text-xs text-zinc-400 dark:text-zinc-500">
                    Current
                  </span>
                )}
              </button>
              {!isCurrent && onDelete && (
                <button
                  type="button"
                  onClick={() => onDelete(v.id)}
                  className="flex h-10 w-10 items-center justify-center text-lg text-zinc-400 hover:text-red-600 dark:text-zinc-500 dark:hover:text-red-400"
                  title="Delete this version"
                >
                  ×
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
});
