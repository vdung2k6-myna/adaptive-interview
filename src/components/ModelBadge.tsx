"use client";

import React from "react";

interface ModelBadgeProps {
  model: string;
}

export const ModelBadge = React.memo(function ModelBadge({ model }: ModelBadgeProps) {
  return (
    <span className="inline-flex items-center rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
      🤖 {model}
    </span>
  );
});
