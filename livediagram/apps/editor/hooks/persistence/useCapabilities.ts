'use client';

import { useEffect, useState } from 'react';
import { apiGetCapabilities } from '@/lib/api-client';

// Fetches GET /api/capabilities once at mount and returns which
// optional server features are available. Fails closed on any network
// error — a missing or mis-configured api worker means no features.
// The result is stable for the lifetime of the page; no polling needed
// because capabilities are determined by deployment config, not runtime
// state.
export function useCapabilities(enabled = true): { aiEnabled: boolean; emailEnabled: boolean } {
  const [aiEnabled, setAiEnabled] = useState(false);
  const [emailEnabled, setEmailEnabled] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    void apiGetCapabilities().then((caps) => {
      setAiEnabled(caps.aiEnabled);
      setEmailEnabled(caps.emailEnabled ?? false);
    });
  }, [enabled]);

  return { aiEnabled, emailEnabled };
}
