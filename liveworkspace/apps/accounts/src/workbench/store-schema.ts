// The workbench store's tables, and its rows as the store reads them (store.ts).

import type {
  PairingStatus,
  WorkbenchPairingRow,
  WorkbenchReach,
  WorkbenchScope,
} from './store-types.ts';

// ---------- Schema ---------------------------------------------------------------------------------------------

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS wb_pairing_requests (
  code        TEXT    PRIMARY KEY,
  app         TEXT    NOT NULL,
  token_id    TEXT    NOT NULL,
  origin      TEXT    NOT NULL,
  name        TEXT,
  scope       TEXT    NOT NULL CHECK (scope IN ('item', 'workspace')),
  status      TEXT    NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined')),
  created_at  INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL,
  answered_at INTEGER
);
CREATE UNIQUE INDEX IF NOT EXISTS wb_pairing_requests_live
  ON wb_pairing_requests (app, token_id, origin, scope) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS wb_pairing_requests_expiry ON wb_pairing_requests (expires_at);
CREATE TABLE IF NOT EXISTS wb_pairings (
  id         TEXT    PRIMARY KEY,
  app        TEXT    NOT NULL,
  token_id   TEXT    NOT NULL,
  origin     TEXT    NOT NULL,
  name       TEXT,
  scope      TEXT    NOT NULL CHECK (scope IN ('item', 'workspace')),
  created_at INTEGER NOT NULL,
  UNIQUE (app, token_id, origin)
);
CREATE INDEX IF NOT EXISTS wb_pairings_token ON wb_pairings (token_id);
CREATE TABLE IF NOT EXISTS wb_tickets (
  ticket_hash TEXT    PRIMARY KEY,
  app         TEXT    NOT NULL,
  token_id    TEXT    NOT NULL,
  pairing_id  TEXT    NOT NULL REFERENCES wb_pairings (id) ON DELETE CASCADE,
  scope       TEXT    NOT NULL,
  item_id     TEXT,
  folder_id   TEXT,
  tab_id      TEXT,
  origin      TEXT    NOT NULL,
  role        TEXT    NOT NULL,
  created_at  INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL,
  used_at     INTEGER,
  CHECK ((scope = 'workspace') = (item_id IS NULL)),
  CHECK (scope = 'workspace' OR folder_id IS NULL)
);
CREATE INDEX IF NOT EXISTS wb_tickets_expiry ON wb_tickets (expires_at);
CREATE INDEX IF NOT EXISTS wb_tickets_pairing ON wb_tickets (pairing_id);
CREATE TABLE IF NOT EXISTS wb_sessions (
  id          TEXT    PRIMARY KEY,
  secret_hash TEXT    NOT NULL UNIQUE,
  app         TEXT    NOT NULL,
  token_id    TEXT    NOT NULL,
  pairing_id  TEXT    NOT NULL REFERENCES wb_pairings (id) ON DELETE CASCADE,
  scope       TEXT    NOT NULL,
  item_id     TEXT,
  folder_id   TEXT,
  tab_id      TEXT,
  origin      TEXT    NOT NULL,
  role        TEXT    NOT NULL,
  created_at  INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL,
  CHECK ((scope = 'workspace') = (item_id IS NULL)),
  CHECK (scope = 'workspace' OR folder_id IS NULL)
);
CREATE INDEX IF NOT EXISTS wb_sessions_pairing ON wb_sessions (pairing_id);
CREATE INDEX IF NOT EXISTS wb_sessions_expiry ON wb_sessions (expires_at);
CREATE TABLE IF NOT EXISTS wb_session_rooms (
  session_id TEXT NOT NULL REFERENCES wb_sessions (id) ON DELETE CASCADE,
  item_id    TEXT NOT NULL,
  PRIMARY KEY (session_id, item_id)
);
CREATE TABLE IF NOT EXISTS wb_quota (
  kind  TEXT    NOT NULL,
  at    INTEGER NOT NULL,
  until INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS wb_quota_kind ON wb_quota (kind, at);
CREATE INDEX IF NOT EXISTS wb_quota_until ON wb_quota (until);
CREATE TABLE IF NOT EXISTS wb_meta (
  key   TEXT PRIMARY KEY,
  value      NOT NULL
)`;

export type Row = Record<string, unknown>;

export type ReachColumns = { scope: string; item_id: string | null; folder_id: string | null };

export function reachOf(row: ReachColumns): WorkbenchReach {
  if (row.scope === 'workspace')
    return { scope: 'workspace', itemId: null, folderId: row.folder_id };
  if (row.item_id === null) throw new Error('workbench: an item row with no item');
  return { scope: 'item', itemId: row.item_id, folderId: null };
}

export const toPairing = (row: Row): WorkbenchPairingRow => ({
  id: row.id as string,
  app: row.app as string,
  tokenId: row.token_id as string,
  origin: row.origin as string,
  name: (row.name as string | null) ?? null,
  scope: row.scope as WorkbenchScope,
  pairedAt: row.created_at as number,
});

export const PAIRING_COLUMNS = 'id, app, token_id, origin, name, scope, created_at';

export const effectiveStatus = (status: string, expiresAt: number, now: number): PairingStatus =>
  status === 'pending' && expiresAt <= now ? 'expired' : (status as PairingStatus);

// A workspace pairing also covers the item scope; an item pairing never covers the workspace.
export const pairingCovers = (pairing: WorkbenchScope, asked: WorkbenchScope) =>
  pairing === 'workspace' || asked === 'item';
