// share_links — per-diagram, per-role short codes (migration 0003,
// expiry columns from 0020 / spec/34). Row shape + role normalisation
// live in share-link-row.ts so the defensive mapper has its own test
// surface.

import { SHARE_LINK_EXPIRY_MS, type ShareLinkExpiry } from '@livediagram/api-schema';
import { rowToShareLink, type ShareLinkRow } from '../share-link-row';
import type { Env, ShareLinkDTO, ShareRole } from '../types';

const SHARE_LINK_COLS = 'code, diagram_id, role, created_at, expiry, expires_at';

// The deadline a non-'never' choice arms, measured from now.
function expiresAtFor(expiry: ShareLinkExpiry, from: number): number | null {
  return expiry === 'never' ? null : from + SHARE_LINK_EXPIRY_MS[expiry];
}

// Short, URL-safe alphabet. Avoids visually ambiguous characters
// (0/O/1/I/l) so the share codes are easy to read aloud or transcribe.
const SHARE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateShareCode(length = 8): string {
  let code = '';
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  for (const byte of bytes) {
    code += SHARE_ALPHABET[byte % SHARE_ALPHABET.length];
  }
  return code;
}

// Owner-facing list for the Share dialog: ALL links, expired included
// — the dialog splits them into Active / Inactive (spec/34).
export async function listShareLinks(env: Env, diagramId: string): Promise<ShareLinkDTO[]> {
  const result = await env.DB.prepare(
    `SELECT ${SHARE_LINK_COLS} FROM share_links WHERE diagram_id = ? ORDER BY created_at ASC`,
  )
    .bind(diagramId)
    .all<ShareLinkRow>();
  return (result.results ?? []).map(rowToShareLink);
}

// The access-side lookup: ACTIVE links only (spec/34). This is the
// single enforcement choke point — the read/edit gates in
// auth/diagram-access.ts, the WebSocket-upgrade role resolution, and
// GET /api/share/:code all come through here, so an expired link
// stops resolving and authorising everywhere at once. Owner-side
// paths that need expired rows use getShareLinkIncludingExpired.
export async function getShareLink(env: Env, code: string): Promise<ShareLinkDTO | null> {
  const row = await env.DB.prepare(
    `SELECT ${SHARE_LINK_COLS} FROM share_links WHERE code = ? AND (expires_at IS NULL OR expires_at > ?)`,
  )
    .bind(code, Date.now())
    .first<ShareLinkRow>();
  return row ? rowToShareLink(row) : null;
}

// Owner-side lookup for delete / extend, which must work on a link
// precisely BECAUSE it has expired.
export async function getShareLinkIncludingExpired(
  env: Env,
  code: string,
): Promise<ShareLinkDTO | null> {
  const row = await env.DB.prepare(`SELECT ${SHARE_LINK_COLS} FROM share_links WHERE code = ?`)
    .bind(code)
    .first<ShareLinkRow>();
  return row ? rowToShareLink(row) : null;
}

export async function createShareLink(
  env: Env,
  diagramId: string,
  code: string,
  role: ShareRole,
  expiry: ShareLinkExpiry = 'never',
): Promise<ShareLinkDTO> {
  const createdAt = Date.now();
  const expiresAt = expiresAtFor(expiry, createdAt);
  await env.DB.prepare(
    'INSERT INTO share_links (code, diagram_id, role, created_at, expiry, expires_at) VALUES (?, ?, ?, ?, ?, ?)',
  )
    .bind(code, diagramId, role, createdAt, expiry === 'never' ? null : expiry, expiresAt)
    .run();
  // Flip the shareable flag on so the realtime room opens + the
  // share-code resolver picks the diagram up. The "primary" code is
  // derived from share_links on read, so no column to update.
  await env.DB.prepare('UPDATE diagrams SET shareable = 1 WHERE id = ?').bind(diagramId).run();
  return { code, diagramId, role, createdAt, expiry, expiresAt };
}

// Re-arm an expiring link for another round of its creation-time
// duration, counted from now (spec/34). Returns the updated link, or
// null when the code doesn't exist or the link never expires (nothing
// to extend — the route maps that to a 400).
export async function extendShareLink(env: Env, code: string): Promise<ShareLinkDTO | null> {
  const existing = await getShareLinkIncludingExpired(env, code);
  if (!existing || existing.expiry === 'never') return null;
  const expiresAt = expiresAtFor(existing.expiry, Date.now());
  await env.DB.prepare('UPDATE share_links SET expires_at = ? WHERE code = ?')
    .bind(expiresAt, code)
    .run();
  return { ...existing, expiresAt };
}

export async function deleteShareLink(env: Env, code: string): Promise<void> {
  const existing = await getShareLinkIncludingExpired(env, code);
  if (!existing) return;
  await env.DB.prepare('DELETE FROM share_links WHERE code = ?').bind(code).run();
  // If this was the last link for the diagram, flip shareable off so
  // the live app stops opening the realtime room. The primary code
  // is derived on read; no column to repoint.
  const remaining = await env.DB.prepare(
    'SELECT COUNT(*) AS n FROM share_links WHERE diagram_id = ?',
  )
    .bind(existing.diagramId)
    .first<{ n: number }>();
  if (!remaining || remaining.n === 0) {
    await env.DB.prepare('UPDATE diagrams SET shareable = 0 WHERE id = ?')
      .bind(existing.diagramId)
      .run();
  }
}
