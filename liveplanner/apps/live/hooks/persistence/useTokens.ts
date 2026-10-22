'use client';

// API token state (docs/specs/015-api/public-api-and-tokens.md), loaded for a signed-in user. Consumed by
// the Settings token manager and the Explorer's timeline token-card menus;
// each mounts its own controller and a change in one refreshes the rest (see
// TOKENS_CHANGED_EVENT). `enabled` gates the fetch (off for guests / when sign-in is not
// configured), mirroring useTeams. Tokens are signed-in only, so `ownerId` here is
// always the signed-in account id when enabled.
import { useCallback, useEffect, useState } from 'react';
import type { ApiToken } from '@liveplanner/api-schema';
import { apiCreateToken, apiListTokens, apiRevokeToken } from '@/lib/api-client';
import { track } from '@/lib/telemetry';

const MAX_TOKENS = 10;
// Two instances can be mounted at once (the Explorer's, for its timeline
// token menus, and the Settings token manager's), so a create or revoke in
// one tells the others to re-read rather than leaving them stale.
const TOKENS_CHANGED_EVENT = 'liveplanner:tokens-changed';
const announceChange = () => window.dispatchEvent(new Event(TOKENS_CHANGED_EVENT));

export type TokensController = {
  list: ApiToken[] | null;
  // Live (unexpired) tokens: the slots of the cap they take.
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
  // When the list was read: what "expired" is measured against (a clock read in render would be impure).
  const [readAt, setReadAt] = useState(0);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!enabled || !ownerId) return;
    apiListTokens(ownerId)
      .then((tokens) => {
        setReadAt(Date.now());
        setList(tokens);
      })
      .catch(() => setError('Could not load tokens.'));
  }, [enabled, ownerId]);
  useEffect(() => {
    load();
    if (!enabled) return;
    window.addEventListener(TOKENS_CHANGED_EVENT, load);
    return () => window.removeEventListener(TOKENS_CHANGED_EVENT, load);
  }, [load, enabled]);

  // The cap counts live tokens only, as the api's mint does: an expired token still listed (until revoked) takes
  // no slot, so it never blocks making a new one.
  const count = list?.filter((t) => t.expiresAt > readAt).length ?? 0;
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
        announceChange();
        return res.token;
      } catch {
        setError('Could not create token.');
        return null;
      } finally {
        setCreating(false);
      }
    },
    [ownerId, creating, atCap],
  );

  const revoke = useCallback(
    async (id: string) => {
      if (!ownerId) return;
      setError(null);
      try {
        await apiRevokeToken(ownerId, id);
        track('Token', 'Removed'); // docs/specs/017-telemetry/telemetry.md: a token was revoked
        announceChange();
      } catch {
        setError('Could not revoke token.');
      }
    },
    [ownerId],
  );

  return { list, count, max: MAX_TOKENS, atCap, creating, error, create, revoke };
}
