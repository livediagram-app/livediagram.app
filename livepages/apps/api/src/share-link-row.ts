import {
  parseStoredLevel,
  type AccessLevel,
  type ShareLink as ShareLinkDTO,
  type ShareLinkExpiry,
  type SharePurpose,
} from '@livediagram/api-schema';

// share_links row shape as read from D1 (migration 0003 + the expiry
// columns from 0020, the tab scope from 0048, the level from 0080). `role` and `level` arrive as free-form
// strings here, but the wire-format DTO carries an AccessLevel. The mapper below normalises. `expiry` / `expires_at` are NULL on every
// pre-0020 row (= never expires).

export type ShareLinkRow = {
  code: string;
  document_id: string;
  role: string;
  // The access level (migration 0080, docs/specs/013-workspace/share-roles.md); NULL on a row written before it,
  // which reads as its `role`.
  level: string | null;
  created_at: number;
  expiry: string | null;
  expires_at: number | null;
  // Tab scope (docs/specs/013-workspace/tab-scoped-share-links.md). NULL = All tabs.
  tab_id: string | null;
  // What the link is for (docs/specs/025-community/community.md, migration 0068). NOT NULL DEFAULT 'share'.
  purpose: string;
};

// Pure mapper from D1 row to wire-format DTO. Pulled out of db.ts
// so the defensive role normalisation has a test surface of its
// own without dragging the rest of the D1 module along (same
// pattern as image-strip.ts, image-sniff.ts, tab-row.ts).
//
// The level reads through `parseStoredLevel` (docs/specs/013-workspace/share-roles.md, blueprint I2): `level`
// when the row has one, else the legacy two-valued `role`, and anything unknown reads as view, so a value this
// worker does not know never escalates anyone.
export function rowToShareLink(row: ShareLinkRow): ShareLinkDTO {
  return {
    code: row.code,
    documentId: row.document_id,
    role: storedLevelOf(row),
    createdAt: row.created_at,
    expiry: normaliseExpiry(row.expiry),
    expiresAt: row.expires_at ?? null,
    tabId: row.tab_id ?? null,
    purpose: normalisePurpose(row.purpose),
  };
}

// Only the exact 'community' marks a post's link: anything else is an ordinary link, which is the side that keeps
// a link listed and revocable by its owner.
function normalisePurpose(value: string | null | undefined): SharePurpose {
  return value === 'community' ? 'community' : 'share';
}

// Same defensive posture as the role check, opposite bias: an
// unrecognised expiry token normalises to 'never', which only
// affects what the Extend button re-applies (enforcement reads
// `expires_at` directly in SQL, so a corrupted token can't make an
// expired link live again).
function normaliseExpiry(value: string | null): ShareLinkExpiry {
  return value === 'week' || value === 'month' || value === 'sixMonths' ? value : 'never';
}

// A share_links or shared_with row's level: `level` (0080) when set, else the legacy `role`.
export function storedLevelOf(row: { role: string; level?: string | null }): AccessLevel {
  return parseStoredLevel(row.level ?? row.role);
}

// What a level is written as in the legacy two-valued `role` column: anything below edit is 'view', so a reader
// that predates the `level` column reads a Participant link as a Viewer and fails closed (migration 0080).
export function legacyRoleColumn(level: AccessLevel): 'edit' | 'view' {
  return level === 'edit' ? 'edit' : 'view';
}

// The level as stored in the `level` column: NULL where the legacy role already says it, so a Viewer or Editor
// row reads exactly as one written before 0080.
export function levelColumn(level: AccessLevel): AccessLevel | null {
  return level === 'participate' ? level : null;
}
