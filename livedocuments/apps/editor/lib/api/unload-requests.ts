// What a request sent while the page goes needs (docs/specs/006-document/per-tab-storage.md "Saving",
// docs/specs/012-collaboration/speaker-note-cards.md "Saving"): headers built synchronously, because a `pagehide` or
// `beforeunload` handler cannot await the async token provider (apiHeaders), and `keepalive`, so the request outlives
// the page, while it fits the browser's budget. Shared by the tab beacon (tabs.ts) and the deck's unload save.
import { INDEX_GRANT_HEADER } from '@livedocuments/api-schema';
import { isOfflineIdSync, offlineSaveDocumentMeta } from '../offline/offline-store';
import { heldDocumentGrant } from './document-grants';
import {
  API_BASE,
  apiFetch,
  getLastKnownToken,
  getSessionSharePassword,
  identityHeaders,
} from './core';

// The keepalive bodies the page sends at most while it goes: browsers allow 64 KB in all per page, and refuse a
// keepalive request past it; the rest is headroom for one already in flight. Safe range: 32 KB to 63 KB.
export const KEEPALIVE_BUDGET_BYTES = 60 * 1024;

// The budget is the page's, not one flush's: the tab beacon and the deck's save both run on the same `pagehide`. It
// fills within one task and is whole again on the next (a page the back-forward cache keeps, or one that lived on).
let keepaliveLeft = KEEPALIVE_BUDGET_BYTES;
let refillQueued = false;

/** Whether a body of this many bytes may go as keepalive now; takes its bytes from the budget when it may. */
export function takeKeepalive(bytes: number): boolean {
  if (!refillQueued) {
    refillQueued = true;
    setTimeout(resetKeepaliveBudget, 0);
  }
  if (bytes > keepaliveLeft) return false;
  keepaliveLeft -= bytes;
  return true;
}

/** The budget whole again: the next task's, and each test's. */
export function resetKeepaliveBudget(): void {
  keepaliveLeft = KEEPALIVE_BUDGET_BYTES;
  refillQueued = false;
}

/** A body's size as the budget counts it. */
export const bodyBytes = (body: string | undefined): number =>
  body ? new TextEncoder().encode(body).length : 0;

// The unload requests go at once, with the grant they hold (apiFetch `documentGrant: false`).
export const NO_GRANT_WAIT = { documentGrant: false } as const;

/**
 * A request's headers, synchronously: the Bearer token apiHeaders cached on its last fetch for a signed-in session,
 * else the guest token (the rule is apiHeaders' own, identityHeaders), the share code, the document grant held and
 * the session's share password. Null for a signed-in owner with no cached token: every write would 401.
 */
export function unloadHeaders(
  ownerId: string,
  documentId: string,
  shareCode: string | null,
): Record<string, string> | null {
  let base: Record<string, string>;
  try {
    base = identityHeaders(ownerId, getLastKnownToken());
  } catch {
    console.warn('[save] unload flush skipped: no session token for a signed-in owner');
    return null;
  }
  if (shareCode) base['X-Share-Code'] = shareCode;
  const grant = heldDocumentGrant(documentId, shareCode ? { code: shareCode } : null);
  if (grant) base[INDEX_GRANT_HEADER] = grant;
  // The share password (docs/specs/013-workspace/share-password.md): without it an edit-role visitor's flush 403s on
  // a protected document.
  const sharePassword = getSessionSharePassword();
  if (sharePassword) base['X-Share-Password'] = sharePassword;
  return base;
}

/**
 * The deck's save as the page goes (speaker-note-cards.md "Saving"): synchronous, like the tab beacon. Offline Mode
 * writes it to IndexedDB (best effort: the page may go first); otherwise one PUT, kept alive while it fits.
 */
export function saveDocumentMetaOnUnload(
  ownerId: string,
  d: { id: string; presentation: string | null; presentationBase?: string | null },
  shareCode: string | null,
): void {
  if (isOfflineIdSync(d.id)) {
    void offlineSaveDocumentMeta(d.id, { presentation: d.presentation }, Date.now());
    return;
  }
  const headers = unloadHeaders(ownerId, d.id, shareCode);
  if (!headers) return;
  const body = JSON.stringify({
    presentation: d.presentation,
    presentationBase: d.presentationBase,
  });
  void apiFetch(
    `${API_BASE}/documents/${d.id}`,
    {
      method: 'PUT',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body,
      keepalive: takeKeepalive(bodyBytes(body)),
    },
    NO_GRANT_WAIT,
  ).catch(() => {});
}
