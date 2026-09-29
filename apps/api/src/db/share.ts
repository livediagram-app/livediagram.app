// share_links — per-document, per-role short codes (migration 0003,
// expiry columns from 0020 / docs/specs/013-workspace/share-link-expiry.md). Row shape + role normalisation
// live in share-link-row.ts so the defensive mapper has its own test
// surface.

import { SHARE_LINK_EXPIRY_MS, type ShareLinkExpiry } from '@livediagram/api-schema';
import { rowToShareLink, type ShareLinkRow } from '../share-link-row';
import type { Env, ShareLinkDTO, ShareRole } from '../types';

const SHARE_LINK_COLS = 'code, document_id, role, created_at, expiry, expires_at, tab_id';

// A tab-scoped link (docs/specs/013-workspace/tab-scoped-share-links.md) is only a link while its tab is
// still in the document. Part of the access lookup itself, so a race between a
// tab delete and a request can't open anything.
const SCOPE_STILL_VALID =
  '(tab_id IS NULL OR EXISTS (SELECT 1 FROM document_tabs dt WHERE dt.document_id = share_links.document_id AND dt.tab_id = share_links.tab_id))';

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
// — the dialog splits them into Active / Inactive (docs/specs/013-workspace/share-link-expiry.md).
export async function listShareLinks(env: Env, documentId: string): Promise<ShareLinkDTO[]> {
  const result = await env.DB.prepare(
    `SELECT ${SHARE_LINK_COLS} FROM share_links WHERE document_id = ? ORDER BY created_at ASC`,
  )
    .bind(documentId)
    .all<ShareLinkRow>();
  return (result.results ?? []).map(rowToShareLink);
}

// The access-side lookup: ACTIVE links only (docs/specs/013-workspace/share-link-expiry.md), and a scoped
// link only while its tab is in the document (tab-scoped-share-links.md). This is the
// single enforcement choke point — the read/edit gates in
// auth/document-access.ts, the WebSocket-upgrade role resolution, and
// GET /api/share/:code all come through here, so an expired link
// stops resolving and authorising everywhere at once. Owner-side
// paths that need expired rows use getShareLinkIncludingExpired.
export async function getShareLink(env: Env, code: string): Promise<ShareLinkDTO | null> {
  const row = await env.DB.prepare(
    `SELECT ${SHARE_LINK_COLS} FROM share_links WHERE code = ? AND (expires_at IS NULL OR expires_at > ?) AND ${SCOPE_STILL_VALID}`,
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
  documentId: string,
  code: string,
  role: ShareRole,
  expiry: ShareLinkExpiry = 'never',
  tabId: string | null = null,
): Promise<ShareLinkDTO> {
  const createdAt = Date.now();
  const expiresAt = expiresAtFor(expiry, createdAt);
  await env.DB.prepare(
    'INSERT INTO share_links (code, document_id, role, created_at, expiry, expires_at, tab_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
  )
    .bind(code, documentId, role, createdAt, expiry === 'never' ? null : expiry, expiresAt, tabId)
    .run();
  // Flip the shareable flag on so the realtime room opens + the
  // share-code resolver picks the document up. The "primary" code is
  // derived from share_links on read, so no column to update.
  await env.DB.prepare('UPDATE documents SET shareable = 1 WHERE id = ?').bind(documentId).run();
  return { code, documentId, role, createdAt, expiry, expiresAt, tabId };
}

// Re-arm an expiring link for another round of its creation-time
// duration, counted from now (docs/specs/013-workspace/share-link-expiry.md). Returns the updated link, or
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

// Change a link's scope (docs/specs/013-workspace/tab-scoped-share-links.md): null widens it to All tabs.
// The route has already checked the tab belongs to the document. Null when the
// code doesn't exist.
export async function rescopeShareLink(
  env: Env,
  code: string,
  tabId: string | null,
): Promise<ShareLinkDTO | null> {
  const existing = await getShareLinkIncludingExpired(env, code);
  if (!existing) return null;
  await env.DB.prepare('UPDATE share_links SET tab_id = ? WHERE code = ?').bind(tabId, code).run();
  return { ...existing, tabId };
}

// A deleted tab takes its scoped links with it (docs/specs/013-workspace/tab-scoped-share-links.md). Returns
// the deleted codes so the caller can tell their holders (share-revoked).
export async function deleteShareLinksForTab(
  env: Env,
  documentId: string,
  tabId: string,
): Promise<string[]> {
  const res = await env.DB.prepare(
    'SELECT code FROM share_links WHERE document_id = ? AND tab_id = ?',
  )
    .bind(documentId, tabId)
    .all<{ code: string }>();
  const codes = (res.results ?? []).map((r) => r.code);
  if (codes.length === 0) return codes;
  await env.DB.prepare('DELETE FROM share_links WHERE document_id = ? AND tab_id = ?')
    .bind(documentId, tabId)
    .run();
  await closeSharingIfNoLinksLeft(env, documentId);
  return codes;
}

export async function deleteShareLink(env: Env, code: string): Promise<void> {
  const existing = await getShareLinkIncludingExpired(env, code);
  if (!existing) return;
  await env.DB.prepare('DELETE FROM share_links WHERE code = ?').bind(code).run();
  await closeSharingIfNoLinksLeft(env, existing.documentId);
}

// If the last link for the document just went, flip shareable off so the live
// app stops opening the realtime room. The primary code is derived on read;
// no column to repoint.
async function closeSharingIfNoLinksLeft(env: Env, documentId: string): Promise<void> {
  const remaining = await env.DB.prepare(
    'SELECT COUNT(*) AS n FROM share_links WHERE document_id = ?',
  )
    .bind(documentId)
    .first<{ n: number }>();
  if (!remaining || remaining.n === 0) {
    await env.DB.prepare('UPDATE documents SET shareable = 0 WHERE id = ?').bind(documentId).run();
  }
}
