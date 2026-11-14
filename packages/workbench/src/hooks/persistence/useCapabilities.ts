'use client';

import { useEffect, useState } from 'react';

// Fetches GET /api/capabilities once at mount and returns which
// optional server features are available. Fails closed on any network
// error: a missing or mis-configured api worker means no features.
// The result is stable for the lifetime of the page; no polling needed
// because capabilities are determined by deployment config, not runtime
// state.
// Each editor binds it once, at module scope in its `hooks/persistence/useCapabilities.ts`, to its api client.
// `emailEnabled` every editor reads; `more` names the flags only that editor's api answers (livediagram's
// `aiEnabled`, liveplanner's `githubEnabled`), each true only when the api says exactly true.
export function createCapabilities<K extends string = never>(
  // `K` comes from `more` alone, so an answer's other fields (livedesign's `apiBase`) never become flags.
  apiGetCapabilities: () => Promise<
    { emailEnabled?: boolean } & Partial<Record<NoInfer<K>, boolean>>
  >,
  more: readonly K[] = [],
) {
  type Capabilities = { emailEnabled: boolean } & Record<K, boolean>;
  const read = (c: Partial<Record<string, boolean>>): Capabilities =>
    Object.fromEntries([
      ['emailEnabled', c['emailEnabled'] ?? false],
      ...more.map((k) => [k, c[k] === true]),
    ]) as Capabilities;
  return function useCapabilities(enabled = true): Capabilities {
    const [caps, setCaps] = useState(() => read({}));

    useEffect(() => {
      if (!enabled) return;
      void apiGetCapabilities().then((c) => setCaps(read(c)));
    }, [enabled]);

    return caps;
  };
}
