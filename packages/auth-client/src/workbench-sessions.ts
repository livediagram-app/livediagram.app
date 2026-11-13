// An app api's view of the `lvw_` bearer (each product's docs/specs/013-workspace/blueprints/workbench-embeds.md
// "A request bearing lvw_"). Sessions are liveworkspace's (liveworkspace/docs/specs/011-workbench/workbench.md): the
// api asks accounts about each one with its client credentials, and keeps the answer per isolate (a live one for up
// to a minute, never past its expiry; a refused one ten seconds), so a frame's burst of saves and reads costs one
// request a minute, not one each. Each api's auth/workbench-session.ts hands in its credentials, how it names what a
// session reaches, and the error it throws when accounts can't answer.
import type { TeamClaim } from './account';
import type { ClientCredentials } from './oauth';
import {
  createWorkbenchRoomNoter,
  createWorkbenchSessionChecker,
  type WorkbenchSessionCheck,
  type WorkbenchSessionChecker,
  type WorkbenchSessionRefusal,
} from './workbench';

// The logged handle of a session: its id's first 8 characters, never the secret.
export const sessionPrefixOf = (sessionId: string) => sessionId.slice(0, 8);

/** A checked session as an api's request context holds it, beside what it reaches in the api's own names. */
export type WorkbenchSessionFields = Pick<
  WorkbenchSessionCheck,
  'sessionId' | 'ownerId' | 'tokenId' | 'pairingId' | 'tabId' | 'origin' | 'level' | 'expiresAt'
> & { teams: TeamClaim[] };

export type WorkbenchSessionResolution<Reach> =
  | { ok: true; workbench: WorkbenchSessionFields & Reach }
  | { ok: false; reason: WorkbenchSessionRefusal; sessionPrefix?: string };

export function createWorkbenchSessions<Env, Reach>(deps: {
  credentials: (env: Env) => ClientCredentials | null;
  // What the session reaches, as this api names it. An item session always names its item: the checker refuses
  // one that doesn't, as unknown.
  reach: (session: WorkbenchSessionCheck) => Reach;
  // Thrown when liveworkspace can't answer, so the caller answers 503 rather than calling a good session bad.
  unavailable: () => Error;
}) {
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

  // The session a secret is, confined to what it reaches, or why not.
  async function resolveWorkbenchSession(
    env: Env,
    secret: string,
  ): Promise<WorkbenchSessionResolution<Reach>> {
    const credentials = deps.credentials(env);
    if (!credentials) return { ok: false, reason: 'unknown' };
    let result;
    try {
      result = await checkerFor(credentials)(secret);
    } catch (err) {
      console.error('[workbench] liveworkspace unreachable', err);
      throw deps.unavailable();
    }
    if (!result.ok) return { ok: false, reason: result.reason };
    const s = result.session;
    return {
      ok: true,
      workbench: {
        sessionId: s.sessionId,
        ownerId: s.ownerId,
        tokenId: s.tokenId,
        pairingId: s.pairingId,
        ...deps.reach(s),
        tabId: s.tabId,
        origin: s.origin,
        level: s.level,
        expiresAt: s.expiresAt,
        teams: s.teams,
      },
    };
  }

  // A workspace session joined an item's room: liveworkspace notes it once per session and item per isolate, so
  // ending the session's access closes this room too (WB55). Best effort, off the response's path.
  async function noteWorkbenchRoom(
    env: Env,
    workbench: { ownerId: string; sessionId: string },
    itemId: string,
  ): Promise<void> {
    const credentials = deps.credentials(env);
    if (!credentials) return;
    const key = keyOf(credentials);
    let note = noters.get(key);
    if (!note) {
      note = createWorkbenchRoomNoter(credentials);
      noters.set(key, note);
    }
    try {
      await note({ ownerId: workbench.ownerId, sessionId: workbench.sessionId, itemId });
    } catch (err) {
      console.warn('[workbench] room note failed', { error: String(err) });
    }
  }

  return { resolveWorkbenchSession, noteWorkbenchRoom };
}
