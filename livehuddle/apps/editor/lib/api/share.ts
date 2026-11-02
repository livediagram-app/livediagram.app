// Opening a canvas through a share link (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Sharing and access"). The link
// is the index's: the api resolves it there and answers the canvas as the link opens it, with the level, the tab it
// is scoped to and, for a Community post's link, the post. Later requests about the canvas carry the index's grant
// through the link (document-grants.ts). Managing links and the share password is the shared Explorer's Share
// dialog (@liveworkspace/explorer `ShareDialog`), straight to the index.
import {
  COMMUNITY_UNKNOWN_AUTHOR,
  type CommunityShareInfo,
  type DocumentResponse,
  type ShareRole,
} from '@livehuddle/api-schema';
import { dedupeInFlight } from '@liveworkspace/workbench/lib/dedupe';
import {
  API_BASE,
  apiHeaders,
  expectOkOrNull,
  type SharedDocumentResolution,
  apiFetch,
} from './core';
import { parseStoredLevel } from '@livehuddle/api-schema';

// Resolve a share code to a full canvas + the level granted by that
// code. Visitors landing on `/document/shared?s=<code>` use
// this; revoked codes return 404 from the API. Deduped by `${code}|
// ${ownerId}` so Strict Mode's double-invoke doesn't fire two share
// lookups for the same visitor, while a different visitor on the
// same code still gets its own lookup. The visitor's Bearer rides it, so
// the index knows who opened the link (their Shared With Me).
async function _apiLoadShared(
  code: string,
  ownerId: string,
): Promise<SharedDocumentResolution | null> {
  const res = await apiFetch(`${API_BASE}/share/${code}`, {
    headers: await apiHeaders(ownerId, { share: null }),
  });
  // Password gate (docs/specs/013-workspace/share-password.md): 401 = the document is protected and we sent
  // no (or no longer-valid) password; 403 = we sent a wrong one. Both
  // surface as `passwordRequired` so the editor shows the gate; only
  // 403 flags `invalid` so it can show an error line. The password the
  // visitor enters next is attached automatically by apiHeaders.
  if (res.status === 401 || res.status === 403) {
    return { passwordRequired: true, invalid: res.status === 403 };
  }
  const body = await expectOkOrNull<
    DocumentResponse & {
      role?: ShareRole;
      tabId?: string | null;
      community?: CommunityShareInfo | null;
    }
  >(res, 'load shared');
  if (!body) return null;
  return {
    document: body.document,
    role: parseStoredLevel(body.role),
    tabId: typeof body.tabId === 'string' ? body.tabId : null,
    community: readCommunityShareInfo(body.community),
  };
}

// The Community post a community link belongs to (docs/specs/025-community/community.md "Viewing a
// post's document"), or null for an ordinary link. Tolerant of a malformed field: a link that can't be
// read as a Community one opens as an ordinary view link.
export function readCommunityShareInfo(raw: unknown): CommunityShareInfo | null {
  if (!raw || typeof raw !== 'object') return null;
  const { postId, author } = raw as { postId?: unknown; author?: unknown };
  if (typeof postId !== 'string' || !postId || !author || typeof author !== 'object') return null;
  const a = author as { name?: unknown; color?: unknown; picture?: unknown };
  return {
    postId,
    author: {
      name: typeof a.name === 'string' && a.name ? a.name : COMMUNITY_UNKNOWN_AUTHOR.name,
      color: typeof a.color === 'string' && a.color ? a.color : COMMUNITY_UNKNOWN_AUTHOR.color,
      picture: typeof a.picture === 'string' && a.picture ? a.picture : null,
    },
  };
}
export const apiLoadShared = dedupeInFlight(
  _apiLoadShared,
  (code, ownerId) => `${code}|${ownerId}`,
);
