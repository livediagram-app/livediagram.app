// An app's server and liveworkspace's workbench service (liveworkspace/docs/specs/011-workbench/workbench.md): pairing, tickets and
// sessions live in the accounts Worker, and an app only checks the `lvw_` sessions its API is shown, tells accounts
// which room a workspace session joined, and takes its senders' notification email allowance. Each sends the app's
// client credentials, so these run in the app's Worker only.
import { call, readTeamsClaim, sha256, type TeamClaim } from './account';
import type { ClientCredentials } from './oauth';

export type WorkbenchLevel = 'view' | 'participate' | 'edit';

// A session as accounts answers it for this app: whose it is, which token and pairing it came from, what it reaches
// (one item, or the workspace from an optional folder), its level (already capped by a read-only token) and the
// account's teams now.
export interface WorkbenchSessionCheck {
  sessionId: string;
  ownerId: string;
  tokenId: string;
  pairingId: string;
  scope: 'item' | 'workspace';
  itemId: string | null;
  folderId: string | null;
  tabId: string | null;
  origin: string;
  level: WorkbenchLevel;
  expiresAt: number;
  teams: TeamClaim[];
}

// Why a session is refused: none such (or another app's), its token revoked or expired, or it ran out.
export type WorkbenchSessionRefusal = 'unknown' | 'revoked' | 'expired';

export type WorkbenchSessionResult =
  { ok: true; session: WorkbenchSessionCheck } | { ok: false; reason: WorkbenchSessionRefusal };

export interface WorkbenchCheckerOptions {
  // How long a live session is trusted without asking again (never past its own expiry): also how long an
  // unpaired or revoked one can go on working in one isolate. Its rooms close at once all the same.
  validForMs?: number;
  // How long a refused session stays refused without asking again.
  invalidForMs?: number;
  // Sessions remembered per isolate; the oldest go first.
  maxEntries?: number;
  fetcher?: typeof fetch;
  now?: () => number;
}

// The global fetch looked up on each call, not when a checker is built, so one built at module scope follows a
// fetch replaced later (as tests do).
const globalFetch = ((...args: Parameters<typeof fetch>) => fetch(...args)) as typeof fetch;

export const WORKBENCH_SESSION_VALID_FOR_MS = 60_000;
export const WORKBENCH_SESSION_INVALID_FOR_MS = 10_000;
export const WORKBENCH_SESSION_CACHE_MAX = 1_000;

const isLevel = (value: unknown): value is WorkbenchLevel =>
  value === 'view' || value === 'participate' || value === 'edit';

const refusalOf = (value: unknown): WorkbenchSessionRefusal =>
  value === 'revoked' || value === 'expired' ? value : 'unknown';

function sessionOf(data: Record<string, unknown>): WorkbenchSessionCheck | null {
  const text = (key: string) => (typeof data[key] === 'string' ? (data[key] as string) : null);
  const scope = data.scope === 'workspace' ? 'workspace' : data.scope === 'item' ? 'item' : null;
  const sessionId = text('sessionId');
  const ownerId = text('ownerId');
  const tokenId = text('tokenId');
  const pairingId = text('pairingId');
  const origin = text('origin');
  if (!scope || !sessionId || !ownerId || !tokenId || !pairingId || !origin) return null;
  if (!isLevel(data.level) || typeof data.expiresAt !== 'number') return null;
  const itemId = text('itemId');
  if ((scope === 'item') !== (itemId !== null)) return null;
  return {
    sessionId,
    ownerId,
    tokenId,
    pairingId,
    scope,
    itemId,
    folderId: scope === 'workspace' ? text('folderId') : null,
    tabId: text('tabId'),
    origin,
    level: data.level,
    expiresAt: data.expiresAt,
    teams: readTeamsClaim(data.teams) ?? [],
  };
}

// Checks `lvw_` sessions with liveworkspace, remembering each answer per isolate, so a frame's burst of saves and
// reads costs one request a minute, not one each. Build it once at module scope. Throws when liveworkspace can't be
// reached, so the caller can answer 503 rather than calling a good session bad.
export function createWorkbenchSessionChecker(
  credentials: ClientCredentials,
  options: WorkbenchCheckerOptions = {},
) {
  const validFor = options.validForMs ?? WORKBENCH_SESSION_VALID_FOR_MS;
  const invalidFor = options.invalidForMs ?? WORKBENCH_SESSION_INVALID_FOR_MS;
  const maxEntries = options.maxEntries ?? WORKBENCH_SESSION_CACHE_MAX;
  const fetcher = options.fetcher ?? globalFetch;
  const now = options.now ?? Date.now;
  const remembered = new Map<string, { result: WorkbenchSessionResult; until: number }>();

  return async function check(secret: string): Promise<WorkbenchSessionResult> {
    const key = await sha256(secret);
    const at = now();
    const known = remembered.get(key);
    if (known && known.until > at) return known.result;
    remembered.delete(key);

    const response = await call(
      credentials,
      '/workbench/session',
      { method: 'POST', body: { session: secret } },
      fetcher,
    );
    let result: WorkbenchSessionResult;
    if (response.ok) {
      const session = sessionOf((await response.json()) as Record<string, unknown>);
      result = session ? { ok: true, session } : { ok: false, reason: 'unknown' };
    } else if (response.status === 404) {
      const body = (await response.json().catch(() => ({}))) as { reason?: unknown };
      result = { ok: false, reason: refusalOf(body.reason) };
    } else {
      throw new Error(`workbench session check failed: ${response.status}`);
    }
    while (remembered.size >= maxEntries) {
      const oldest = remembered.keys().next().value;
      if (oldest === undefined) break;
      remembered.delete(oldest);
    }
    remembered.set(key, {
      result,
      until: at + (result.ok ? Math.min(validFor, result.session.expiresAt - at) : invalidFor),
    });
    return result;
  };
}

export type WorkbenchSessionChecker = ReturnType<typeof createWorkbenchSessionChecker>;

// Tells accounts a workspace session joined an item's room, so ending its access closes that room too. Once per
// session and item per isolate: a room's grant renewals re-mint its ticket every ten minutes, and the first note is
// the one that counts. Best effort: a note that fails is tried again on the next ticket.
export function createWorkbenchRoomNoter(
  credentials: ClientCredentials,
  options: { maxEntries?: number; fetcher?: typeof fetch } = {},
) {
  const maxEntries = options.maxEntries ?? WORKBENCH_SESSION_CACHE_MAX;
  const fetcher = options.fetcher ?? globalFetch;
  const noted = new Set<string>();
  return async function note(input: {
    ownerId: string;
    sessionId: string;
    itemId: string;
  }): Promise<boolean> {
    const key = `${input.sessionId} ${input.itemId}`;
    if (noted.has(key)) return true;
    const response = await call(
      credentials,
      '/workbench/rooms',
      { method: 'POST', body: input },
      fetcher,
    );
    if (!response.ok) return false;
    while (noted.size >= maxEntries) {
      const oldest = noted.values().next().value;
      if (oldest === undefined) break;
      noted.delete(oldest);
    }
    noted.add(key);
    return true;
  };
}

// Takes up to `count` uses of a sender's allowance (`kind`, at most `max` in any `windowMs`), kept per app in the
// sender's own store at accounts; answers how many it took. Throws when accounts can't answer, so the caller sends
// nothing (the allowance is what keeps a sender's emails from becoming spam).
export async function takeAllowance(
  credentials: ClientCredentials,
  input: { personId: string; kind: string; max: number; windowMs: number; count: number },
  fetcher: typeof fetch = fetch,
): Promise<number> {
  const response = await call(credentials, '/allowance', { method: 'POST', body: input }, fetcher);
  if (!response.ok) throw new Error(`allowance failed: ${response.status}`);
  const { taken } = (await response.json()) as { taken?: unknown };
  return typeof taken === 'number' && Number.isInteger(taken) && taken >= 0 ? taken : 0;
}
