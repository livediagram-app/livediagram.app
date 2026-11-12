'use client';

import { useEffect, useState } from 'react';
import { apiGetCapabilities } from '@/lib/api-client';

// Fetches GET /api/capabilities once at mount and returns which
// optional server features are available. Fails closed on any network
// error — a missing or mis-configured api worker means no features.
// The result is stable for the lifetime of the page; no polling needed
// because capabilities are determined by deployment config, not runtime
// state.
// `githubEnabled`: the deployment has liveplanner's GitHub App (docs/specs/026-plan/github-pull-requests.md "The App");
// the Automations screen reads it from the same one read (apiGetCapabilities shares it), never the board.
export function useCapabilities(enabled = true): { emailEnabled: boolean; githubEnabled: boolean } {
  const [caps, setCaps] = useState({ emailEnabled: false, githubEnabled: false });

  useEffect(() => {
    if (!enabled) return;
    void apiGetCapabilities().then((c) => {
      setCaps({ emailEnabled: c.emailEnabled ?? false, githubEnabled: c.githubEnabled === true });
    });
  }, [enabled]);

  return caps;
}
