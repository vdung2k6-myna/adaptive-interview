"use client";

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 p-6 dark:bg-zinc-950">
      <div className="max-w-sm text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-900 dark:bg-zinc-50">
          <svg
            className="h-8 w-8 text-white dark:text-zinc-900"
            viewBox="0 0 24 24"
            fill="currentColor"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M4 4h16v12H7.17L4 19V4z" />
          </svg>
        </div>
        <h1 className="mb-2 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          You&apos;re offline
        </h1>
        <p className="mb-6 text-zinc-600 dark:text-zinc-400">
          Please reconnect to the internet to continue your interview or review
          sessions.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          Retry
        </button>
      </div>
    </div>
  );
}
