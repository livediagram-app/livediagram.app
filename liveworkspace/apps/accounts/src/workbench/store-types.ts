// The workbench store's limits, secrets and shapes (store.ts).

// ---------- Constants -----------------------------------------------------------------------------------------

export const WORKBENCH_SESSION_PREFIX = 'lvw_';
// Random bytes in a ticket, a pairing code and a session secret, before the routing suffix.
export const WORKBENCH_TICKET_BYTES = 16;
export const WORKBENCH_PAIRING_CODE_BYTES = 16;
export const WORKBENCH_SESSION_SECRET_BYTES = 32;
// A pairing request waits this long for its answer.
export const WORKBENCH_PAIRING_TTL_MS = 10 * 60 * 1000;
// A session past its expiry is kept this long, so its refusal reads "expired" rather than "unknown".
export const WORKBENCH_SESSION_GRACE_MS = 24 * 60 * 60 * 1000;
// The most uses one allowance counts: a cap above it is refused as a mistake.
export const WORKBENCH_QUOTA_MAX = 1_000;
// The most rooms one session notes: more is a runaway frame, and one close call to the index carries this many.
export const WORKBENCH_SESSION_ROOMS_MAX = 500;

// A store's id as `DurableObjectId.toString()` gives it, after the secret's dot.
const ROUTE_SUFFIX = /\.([0-9a-f]{64})$/;
// A ticket: 16 random bytes as base64url, then the store's id.
export const WORKBENCH_TICKET_PATTERN = /^[A-Za-z0-9_-]{22}\.[0-9a-f]{64}$/;
// A session: `lvw_`, 32 random bytes as base64url, then the store's id.
export const WORKBENCH_SESSION_PATTERN = /^lvw_[A-Za-z0-9_-]{43}\.[0-9a-f]{64}$/;
// A pairing code: 16 random bytes as base64url.
export const WORKBENCH_CODE_PATTERN = /^[A-Za-z0-9_-]{22}$/;

// ---------- Secrets --------------------------------------------------------------------------------------------

export function randomBase64Url(bytes: number): string {
  const raw = crypto.getRandomValues(new Uint8Array(bytes));
  let binary = '';
  for (const b of raw) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = new Uint8Array(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)),
  );
  let hex = '';
  for (const b of digest) hex += b.toString(16).padStart(2, '0');
  return hex;
}

// The store a routed secret names, or null for a secret with no suffix.
export function storeIdOfSecret(secret: string): string | null {
  return ROUTE_SUFFIX.exec(secret)?.[1] ?? null;
}

// The logged handle of a session: its id's first 8 characters, never the secret.
export const sessionPrefixOf = (sessionId: string) => sessionId.slice(0, 8);

// ---------- Types ----------------------------------------------------------------------------------------------

export type WorkbenchLevel = 'view' | 'participate' | 'edit';
export type WorkbenchScope = 'item' | 'workspace';

// What a ticket or session reaches: one item, or the workspace from an optional folder.
export type WorkbenchReach =
  | { scope: 'item'; itemId: string; folderId: null }
  | { scope: 'workspace'; itemId: null; folderId: string | null };

export type WorkbenchPairingRow = {
  id: string;
  app: string;
  tokenId: string;
  origin: string;
  name: string | null;
  scope: WorkbenchScope;
  pairedAt: number;
};

export type PairingStatus = 'pending' | 'approved' | 'declined' | 'expired';

export type PairingRequestRead = {
  app: string;
  tokenId: string;
  origin: string;
  name: string | null;
  scope: WorkbenchScope;
  expiresAt: number;
  status: PairingStatus;
};

export type PairingAnswer =
  | { outcome: 'approved'; pairing: WorkbenchPairingRow; asked: WorkbenchScope }
  | { outcome: 'declined'; tokenId: string; asked: WorkbenchScope }
  | { outcome: 'missing' }
  | { outcome: 'answered' }
  | { outcome: 'expired' };

export type InvalidTicketReason = 'unknown' | 'used' | 'expired';

export type ConsumedTicket = {
  ownerId: string;
  app: string;
  tokenId: string;
  pairingId: string;
  tabId: string | null;
  origin: string;
  role: WorkbenchLevel;
} & WorkbenchReach;

export type WorkbenchSessionRead = {
  id: string;
  ownerId: string;
  app: string;
  tokenId: string;
  pairingId: string;
  tabId: string | null;
  origin: string;
  role: WorkbenchLevel;
  createdAt: number;
  expiresAt: number;
} & WorkbenchReach;

export type WorkbenchEndTarget = { pairingId: string } | { tokenId: string };
export type WorkbenchEndReason = 'unpaired' | 'revoked' | 'closed';

// A pairing's rooms to close once its rows are gone: each item a session of it had open.
export type RoomsToClose = { app: string; pairingId: string; itemIds: string[] };

export type EndedAccess = { pairings: number; sessions: number; rooms: RoomsToClose[] };

// The slice of a Durable Object's storage the store uses.
export type SqlExec = {
  exec(query: string, ...bindings: unknown[]): { toArray(): Record<string, unknown>[] };
};
export type WorkbenchStorage = {
  sql: SqlExec;
  getAlarm(): Promise<number | null>;
  setAlarm(at: number): Promise<void>;
  deleteAlarm(): Promise<void>;
  deleteAll(): Promise<void>;
};
