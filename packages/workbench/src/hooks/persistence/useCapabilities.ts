'use client';

import { useEffect, useState } from 'react';

// Fetches GET /api/capabilities once at mount and returns which
// optional server features are available. Fails closed on any network
// error: a missing or mis-configured api worker means no features.
// The result is stable for the lifetime of the page; no polling needed
// because capabilities are determined by deployment config, not runtime
// state.
// Each editor binds it once, at module scope in its `hooks/persistence/useCapabilities.ts`, to its api client.
export function createCapabilities(apiGetCapabilities: () => Promise<{ emailEnabled?: boolean }>) {
  return function useCapabilities(enabled = true): { emailEnabled: boolean } {
  const [emailEnabled, setEmailEnabled] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    void apiGetCapabilities().then((caps) => {
      setEmailEnabled(caps.emailEnabled ?? false);
    });
  }, [enabled]);

  return { emailEnabled };
}
}
