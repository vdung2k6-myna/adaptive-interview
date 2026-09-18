"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-950 px-4">
      <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50 mb-2">
        Something went wrong
      </h2>
      <p className="text-zinc-600 dark:text-zinc-400 mb-6 text-center max-w-md">
        {error.message || "An unexpected error occurred. Please try again."}
      </p>
      <button
        onClick={reset}
        className="rounded-lg bg-zinc-900 px-5 py-2 text-white font-medium hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        Try again
      </button>
    </div>
  );
}
