// The `lvw_` bearer (docs/specs/013-workspace/blueprints/workbench-embeds.md "A request bearing lvw_"). A session
// secret is `lvw_`, 32 random bytes and its store's id; the person's workbench store keeps only its SHA-256.

import { sessionPrefixOf } from '@liveworkspace/index-app';
import type { WorkbenchContext } from '../routes/context';
import type { Env } from '../types';
import { documentReachOf, workbenchStoreOfSecretIn } from '../workbench-store';

export { sessionPrefixOf };

type WorkbenchSessionRefusal = 'unknown' | 'revoked' | 'expired';

// One read of the person's store. The token's own state decides `revoked`; the session's expiry `expired`. A
// read-only token lowers the level to view whatever the session row says.
export async function resolveWorkbenchSession(
  env: Pick<Env, 'WORKBENCH'>,
  secret: string,
  now: number,
): Promise<
  | { ok: true; workbench: WorkbenchContext }
  | { ok: false; reason: WorkbenchSessionRefusal; sessionPrefix?: string }
> {
  const store = workbenchStoreOfSecretIn(env, secret);
  const row = store ? await store.readSession(secret) : null;
  if (!row) return { ok: false, reason: 'unknown' };
  const sessionPrefix = sessionPrefixOf(row.id);
  if (row.tokenRevoked || row.tokenExpiresAt <= now)
    return { ok: false, reason: 'revoked', sessionPrefix };
  if (row.expiresAt <= now) return { ok: false, reason: 'expired', sessionPrefix };
  return {
    ok: true,
    workbench: {
      sessionId: row.id,
      ownerId: row.ownerId,
      tokenId: row.tokenId,
      pairingId: row.pairingId,
      ...documentReachOf(row),
      tabId: row.tabId,
      origin: row.origin,
      level: row.tokenReadOnly ? 'view' : row.role,
      expiresAt: row.expiresAt,
    },
  };
}
