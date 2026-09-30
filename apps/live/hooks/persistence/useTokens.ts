'use client';

// API token state (docs/specs/015-api/public-api-and-tokens.md), loaded for a signed-in user so a consumer's
// create form and list read the SAME source: the Settings token manager, and
// the Explorer's timeline token-card menus. `enabled` gates the fetch (off for guests / when Clerk is not
// configured), mirroring useTeams. Tokens are Clerk-only, so `ownerId` here is
// always the signed-in account id when enabled.
import { useCallback, useEffect, useState } from 'react';
import type { ApiToken } from '@livediagram/api-schema';
import { apiCreateToken, apiListTokens, apiRevokeToken } from '@/lib/api-client';
import { track } from '@/lib/telemetry';

const MAX_TOKENS = 10;

export type TokensController = {
  list: ApiToken[] | null;
  count: number;
  // The per-account cap, so a caller can say it without restating it.
  max: number;
  atCap: boolean;
  creating: boolean;
  error: string | null;
  // Mints a token; returns the one-time plaintext secret on success, else null.
  create: (name: string) => Promise<string | null>;
  revoke: (id: string) => Promise<void>;
};

export function useTokens(ownerId: string | null, opts: { enabled: boolean }): TokensController {
  const enabled = opts.enabled && !!ownerId;
  const [list, setList] = useState<ApiToken[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!enabled || !ownerId) return;
    apiListTokens(ownerId)
      .then(setList)
      .catch(() => setError('Could not load tokens.'));
  }, [enabled, ownerId]);
  useEffect(() => {
    load();
  }, [load]);

  const count = list?.length ?? 0;
  const atCap = count >= MAX_TOKENS;

  const create = useCallback(
    async (name: string): Promise<string | null> => {
      if (!ownerId || creating || atCap) return null;
      setCreating(true);
      setError(null);
      try {
        const res = await apiCreateToken(ownerId, name.trim());
        // Anonymous telemetry (docs/specs/017-telemetry/telemetry.md): a token was minted by hand from the
        // Settings token manager. The MCP consent flow tracks its own 'MCP' source separately.
        track('Token', 'Created', 'Manual');
        load();
        return res.token;
      } catch {
        setError('Could not create token.');
        return null;
      } finally {
        setCreating(false);
      }
    },
    [ownerId, creating, atCap, load],
  );

  const revoke = useCallback(
    async (id: string) => {
      if (!ownerId) return;
      setError(null);
      try {
        await apiRevokeToken(ownerId, id);
        track('Token', 'Removed'); // docs/specs/017-telemetry/telemetry.md: a token was revoked
        load();
      } catch {
        setError('Could not revoke token.');
      }
    },
    [ownerId, load],
  );

  return { list, count, max: MAX_TOKENS, atCap, creating, error, create, revoke };
}
