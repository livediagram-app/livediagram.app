'use client';

// API token state (spec/61), loaded once for a signed-in user so the Explorer
// sidebar badge, the New-token header popover, and the list pane all read the
// SAME source. `enabled` gates the fetch (off for guests / when Clerk is not
// configured), mirroring useTeams. Tokens are Clerk-only, so `ownerId` here is
// always the signed-in account id when enabled.
import { useCallback, useEffect, useState } from 'react';
import type { ApiToken } from '@livediagram/api-schema';
import { apiCreateToken, apiListTokens, apiRevokeToken } from '@/lib/api-client';

export const MAX_TOKENS = 10;

export type TokensController = {
  list: ApiToken[] | null;
  count: number;
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
        load();
      } catch {
        setError('Could not revoke token.');
      }
    },
    [ownerId, load],
  );

  return { list, count, atCap, creating, error, create, revoke };
}
