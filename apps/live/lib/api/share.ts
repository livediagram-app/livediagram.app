// Share-link + share-password calls (spec/24): resolve a share code to
// a diagram, list/create/delete links, and set the diagram password.
import type { ShareLink, ShareLinkExpiry, ShareRole } from '@livediagram/api-schema';
import { dedupeInFlight } from '../dedupe';
import {
  API_BASE,
  apiDelete,
  apiHeaders,
  expectOk,
  expectOkOrNull,
  type DiagramResponse,
  type SharedDiagramResolution,
  type ShareLinkResponse,
  type ShareLinksResponse,
  type SharePasswordResponse,
} from './core';

// Resolve a share code to a full diagram + the role granted by that
// code. Visitors landing on `/diagram/shared?s=<code>` use
// this; revoked codes return 404 from the API. Deduped by `${code}|
// ${ownerId}` so Strict Mode's double-invoke doesn't fire two share
// lookups for the same visitor, while a different visitor on the
// same code still gets its own lookup. The visitor's ownerId is
// passed so the api worker can recognise them and record the visit
// into shared_with; without it the worker can't identify the
// visitor and the "Shared with you" list stays empty.
async function _apiLoadShared(
  code: string,
  ownerId: string,
): Promise<SharedDiagramResolution | null> {
  const res = await fetch(`${API_BASE}/share/${code}`, {
    headers: await apiHeaders(ownerId, { share: null }),
  });
  // Password gate (spec/24): 401 = the diagram is protected and we sent
  // no (or no longer-valid) password; 403 = we sent a wrong one. Both
  // surface as `passwordRequired` so the editor shows the gate; only
  // 403 flags `invalid` so it can show an error line. The password the
  // visitor enters next is attached automatically by apiHeaders.
  if (res.status === 401 || res.status === 403) {
    return { passwordRequired: true, invalid: res.status === 403 };
  }
  const body = await expectOkOrNull<DiagramResponse & { role?: ShareRole }>(res, 'load shared');
  if (!body) return null;
  return {
    diagram: body.diagram,
    role: body.role === 'view' ? 'view' : 'edit',
  };
}
export const apiLoadShared = dedupeInFlight(
  _apiLoadShared,
  (code, ownerId) => `${code}|${ownerId}`,
);

// Deduped on `${ownerId}|${id}`: editor mount fires this for the
// share-dialog state alongside the other read endpoints. Strict
// Mode doubling collapses to one fetch.
// Returns the diagram's share links AND its current share password
// (spec/24) in one owner-only round-trip — the Share dialog needs both.
async function _apiListShareLinks(
  ownerId: string,
  id: string,
): Promise<{ links: ShareLink[]; password: string | null }> {
  const res = await fetch(`${API_BASE}/diagrams/${id}/share`, {
    headers: await apiHeaders(ownerId),
  });
  const { links, password } = await expectOk<ShareLinksResponse>(res, 'list share links');
  return { links, password: password ?? null };
}
export const apiListShareLinks = dedupeInFlight(
  _apiListShareLinks,
  (ownerId, id) => `${ownerId}|${id}`,
);

// Set (or clear, with null / empty) the diagram's share password.
// Owner-only on the api side. Returns the stored value (normalised).
export async function apiSetSharePassword(
  ownerId: string,
  id: string,
  password: string | null,
): Promise<string | null> {
  const res = await fetch(`${API_BASE}/diagrams/${id}/share-password`, {
    method: 'PUT',
    headers: await apiHeaders(ownerId, { body: true }),
    body: JSON.stringify({ password }),
  });
  const { password: stored } = await expectOk<SharePasswordResponse>(res, 'set share password');
  return stored ?? null;
}

export async function apiCreateShareLink(
  ownerId: string,
  id: string,
  role: ShareRole,
  expiry: ShareLinkExpiry = 'never',
): Promise<ShareLink> {
  const res = await fetch(`${API_BASE}/diagrams/${id}/share`, {
    method: 'POST',
    headers: await apiHeaders(ownerId, { body: true }),
    body: JSON.stringify({ role, expiry }),
  });
  const { link } = await expectOk<ShareLinkResponse>(res, 'create share link');
  return link;
}

// Re-arm an expiring link for another round of its creation-time
// duration (spec/34). Returns the updated link with its new deadline.
export async function apiExtendShareLink(
  ownerId: string,
  id: string,
  code: string,
): Promise<ShareLink> {
  const res = await fetch(`${API_BASE}/diagrams/${id}/share/${code}/extend`, {
    method: 'POST',
    headers: await apiHeaders(ownerId),
  });
  const { link } = await expectOk<ShareLinkResponse>(res, 'extend share link');
  return link;
}

export async function apiDeleteShareLink(ownerId: string, id: string, code: string): Promise<void> {
  return apiDelete(`${API_BASE}/diagrams/${id}/share/${code}`, ownerId, {
    action: 'delete share link',
  });
}
