"use client";

/**
 * The speech classifier, owned by a voice page rather than by the recorder.
 *
 * The recorder is not mounted on page load — both voice surfaces show a setup or
 * session state first — so a preload inside it starts at the moment a session begins,
 * which is also the moment a person is most likely to press record. This hook starts
 * the model with the page, so the first recording is judged by it rather than falling
 * back to the level gate.
 *
 * The client is created in an effect, not during render. React's development Strict
 * Mode mounts, unmounts, and mounts again; a client created during render would be
 * disposed by the first cleanup and reused dead by the second mount. Creating it per
 * effect run gives each mount its own worker and state.
 *
 * A failure never reaches the page: the client degrades, logs once, and the recorder
 * falls back to the level gate.
 */

import { useEffect, useState } from "react";

import { createBrowserVadWorker, createVadClient, type VadClient } from "./vad-client";
import { VAD_ENABLED } from "./vad-enabled";

export function useVadClient(): VadClient | null {
  const [client, setClient] = useState<VadClient | null>(null);

  useEffect(() => {
    if (!VAD_ENABLED) return;

    const created = createVadClient({
      createWorker: createBrowserVadWorker,
      onDegraded: (reason) => {
        console.warn(`[vad] speech classification unavailable: ${reason}`);
      },
    });

    setClient(created);
    void created.start();

    return () => {
      created.dispose();
    };
  }, []);

  return client;
}
