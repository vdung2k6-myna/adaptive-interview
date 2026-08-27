"use client";

import React, { useState, useCallback } from "react";

interface ScoreInputProps {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  disabled?: boolean;
}

export const ScoreInput = React.memo(function ScoreInput({
  label,
  value,
  onChange,
  disabled = false,
}: ScoreInputProps) {
  const [hovered, setHovered] = useState(0);

  const handleClick = useCallback(
    (score: number) => {
      if (disabled) return;
      onChange(value === score ? null : score);
    },
    [disabled, value, onChange]
  );

  const displayValue = hovered || value || 0;

  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-sm text-zinc-600 dark:text-zinc-400">{label}</span>
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            disabled={disabled}
            onClick={() => handleClick(n)}
            onMouseEnter={() => setHovered(n)}
            onMouseLeave={() => setHovered(0)}
            className={`flex h-10 w-10 items-center justify-center text-lg transition-colors sm:h-8 sm:w-8 ${
              n <= displayValue
                ? "text-yellow-500"
                : "text-zinc-300 dark:text-zinc-600"
            } ${disabled ? "cursor-default" : "cursor-pointer hover:scale-110"}`}
            aria-label={`Score ${n}`}
          >
            ★
          </button>
        ))}
        <span className="ml-2 text-sm text-zinc-700 dark:text-zinc-300 min-w-[2ch]">
          {value ?? "—"}/5
        </span>
      </div>
    </div>
  );
});
