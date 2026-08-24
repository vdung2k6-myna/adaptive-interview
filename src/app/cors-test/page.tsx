"use client";

import { useEffect, useState } from "react";

/**
 * Simple CORS test page.
 * Makes a direct cross-origin fetch to the backend (:4000)
 * from the frontend (:3000) and displays the result.
 */
export default function CorsTestPage() {
  const [status, setStatus] = useState<string>("Loading...");
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<unknown>(null);

  useEffect(() => {
    async function testCors() {
      try {
        const res = await fetch("http://localhost:4000/api/candidates", {
          headers: {
            Authorization: "Bearer dev-secret-token-123",
          },
          credentials: "include",
        });

        if (!res.ok) {
          setStatus(`HTTP ${res.status}`);
          setError(await res.text());
          return;
        }

        const json = await res.json();
        setStatus(`HTTP ${res.status} OK — ${json.length} candidates`);
        setData(json);
      } catch (err) {
        setStatus("Network error");
        setError(err instanceof Error ? err.message : String(err));
      }
    }

    testCors();
  }, []);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">CORS Test</h1>
      <p className="mb-2">
        Fetching <code>http://localhost:4000/api/candidates</code> from
        origin <code>http://localhost:3000</code>
      </p>
      <div className="mb-4">
        <strong>Status:</strong>{" "}
        <span
          className={
            status.includes("OK")
              ? "text-green-600 font-semibold"
              : "text-red-600 font-semibold"
          }
        >
          {status}
        </span>
      </div>
      {error && (
        <pre className="bg-red-50 text-red-800 p-4 rounded mb-4">{error}</pre>
      )}
      {data !== null && (
        <pre className="bg-gray-50 text-gray-800 p-4 rounded overflow-auto max-h-96 text-sm">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}
