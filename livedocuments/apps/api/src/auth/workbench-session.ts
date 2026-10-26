// The `lvw_` bearer (docs/specs/013-workspace/blueprints/workbench-embeds.md "A request bearing lvw_"). Sessions are
// liveworkspace's (liveworkspace/docs/workbench.md): this api asks accounts about each one with its client
// credentials, and keeps the answer per isolate (a live one for up to a minute, never past its expiry; a refused one
// ten seconds), so a frame's burst of saves and reads costs one request a minute, not one each.

import {
  createWorkbenchRoomNoter,
  createWorkbenchSessionChecker,
  type ClientCredentials,
  type WorkbenchSessionChecker,
} from '@liveworkspace/auth-client';
import { AccountsUnavailable } from '../db/api-tokens';
import type { WorkbenchContext } from '../routes/context';
import type { Env } from '../types';
import { accountCredentials } from './accounts';

// What a session reaches, as this api names it: one document, or the workspace from an optional folder.
export type WorkbenchReach =
  | { scope: 'document'; documentId: string; folderId: null }
  | { scope: 'workspace'; documentId: null; folderId: string | null };

type WorkbenchSessionRefusal = 'unknown' | 'revoked' | 'expired';

// The logged handle of a session: its id's first 8 characters, never the secret.
export const sessionPrefixOf = (sessionId: string) => sessionId.slice(0, 8);

type AccountsEnv = Pick<Env, 'ACCOUNTS_URL' | 'ACCOUNTS_CLIENT_ID' | 'ACCOUNTS_CLIENT_SECRET'>;

const keyOf = (c: ClientCredentials) => `${c.accountsUrl} ${c.clientId}`;

// One checker (and one room noter) per credentials for the life of the isolate: they hold the caches.
const checkers = new Map<string, WorkbenchSessionChecker>();
const noters = new Map<string, ReturnType<typeof createWorkbenchRoomNoter>>();

function checkerFor(credentials: ClientCredentials): WorkbenchSessionChecker {
  const key = keyOf(credentials);
  let check = checkers.get(key);
  if (!check) {
    check = createWorkbenchSessionChecker(credentials);
    checkers.set(key, check);
  }
  return check;
}

// The session a secret is, confined to what it reaches, or why not. Throws AccountsUnavailable when liveworkspace
// can't answer, so the caller answers 503 rather than calling a good session bad.
export async function resolveWorkbenchSession(
  env: AccountsEnv,
  secret: string,
): Promise<
  | { ok: true; workbench: WorkbenchContext }
  | { ok: false; reason: WorkbenchSessionRefusal; sessionPrefix?: string }
> {
  const credentials = accountCredentials(env);
  if (!credentials) return { ok: false, reason: 'unknown' };
  let result;
  try {
    result = await checkerFor(credentials)(secret);
  } catch (err) {
    console.error('[workbench] liveworkspace unreachable', err);
    throw new AccountsUnavailable();
  }
  if (!result.ok) return { ok: false, reason: result.reason };
  const s = result.session;
  // An item session always names its item: the shared checker refuses one that doesn't (auth-client workbench.ts).
  const reach: WorkbenchReach =
    s.scope === 'item'
      ? { scope: 'document', documentId: s.itemId!, folderId: null }
      : { scope: 'workspace', documentId: null, folderId: s.folderId };
  return {
    ok: true,
    workbench: {
      sessionId: s.sessionId,
      ownerId: s.ownerId,
      tokenId: s.tokenId,
      pairingId: s.pairingId,
      ...reach,
      tabId: s.tabId,
      origin: s.origin,
      level: s.level,
      expiresAt: s.expiresAt,
      teams: s.teams,
    },
  };
}

// A workspace session joined a document's room: liveworkspace notes it once per session and document per isolate, so ending
// the session's access closes this room too (WB55). Best effort, off the response's path.
export async function noteWorkbenchRoom(
  env: AccountsEnv,
  workbench: Pick<WorkbenchContext, 'ownerId' | 'sessionId'>,
  documentId: string,
): Promise<void> {
  const credentials = accountCredentials(env);
  if (!credentials) return;
  const key = keyOf(credentials);
  let note = noters.get(key);
  if (!note) {
    note = createWorkbenchRoomNoter(credentials);
    noters.set(key, note);
  }
  try {
    await note({ ownerId: workbench.ownerId, sessionId: workbench.sessionId, itemId: documentId });
  } catch (err) {
    console.warn('[workbench] room note failed', { error: String(err) });
  }
}
