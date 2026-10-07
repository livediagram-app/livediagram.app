// Workbench secrets and the `lvw_` bearer (docs/specs/013-workspace/blueprints/workbench-embeds.md "Redemption"
// and "A request bearing lvw_"). A ticket and a pairing code are 16 random bytes; a session is `lvw_` and 32.
// Tickets and sessions are stored as SHA-256 hex only; a pairing code is a public handle stored in the clear.

import {
  bytesToBase64Url,
  sha256Hex,
  WORKBENCH_PAIRING_CODE_BYTES,
  WORKBENCH_SESSION_PREFIX,
  WORKBENCH_SESSION_SECRET_BYTES,
  WORKBENCH_TICKET_BYTES,
} from '@livediagram/api-schema';
import { readWorkbenchSession } from '../db/workbench';
import type { WorkbenchContext } from '../routes/context';
import type { Env } from '../types';

function randomBase64Url(bytes: number): string {
  const buffer = new Uint8Array(bytes);
  crypto.getRandomValues(buffer);
  return bytesToBase64Url(buffer);
}

export const generateWorkbenchTicket = () => randomBase64Url(WORKBENCH_TICKET_BYTES);
export const generatePairingCode = () => randomBase64Url(WORKBENCH_PAIRING_CODE_BYTES);
export const generateWorkbenchSecret = () =>
  WORKBENCH_SESSION_PREFIX + randomBase64Url(WORKBENCH_SESSION_SECRET_BYTES);

export async function hashWorkbenchSecret(secret: string): Promise<string> {
  return sha256Hex(new TextEncoder().encode(secret));
}

// The logged handle of a session: its id's first 8 characters, never the secret.
export const sessionPrefixOf = (sessionId: string) => sessionId.slice(0, 8);

export type WorkbenchSessionRefusal = 'unknown' | 'revoked' | 'expired';

// One indexed read. The token's own state decides `revoked`; the session's expiry `expired`. A read-only
// token lowers the level to view whatever the session row says.
export async function resolveWorkbenchSession(
  env: Env,
  secret: string,
  now: number,
): Promise<
  | { ok: true; workbench: WorkbenchContext }
  | { ok: false; reason: WorkbenchSessionRefusal; sessionPrefix?: string }
> {
  const row = await readWorkbenchSession(env, await hashWorkbenchSecret(secret));
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
      documentId: row.documentId,
      tabId: row.tabId,
      origin: row.origin,
      level: row.tokenReadOnly ? 'view' : row.role,
      expiresAt: row.expiresAt,
    },
  };
}
