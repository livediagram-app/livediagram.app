// Opening a document through a share link (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Sharing and access"). The link
// is the index's: its grant on the document says what the link allows (the level, and the tab it is scoped to), and
// the document is then read with that grant. A Community post's link (docs/specs/025-community/community.md
// "Viewing a post's document") also carries its post, which the api says on `GET /api/share/<code>`. Managing links is
// the shared Explorer's Share dialog (@liveworkspace/explorer `ShareDialog`), straight to the index.
import { IndexError } from '@liveworkspace/index-client';
import {
  COMMUNITY_UNKNOWN_AUTHOR,
  parseStoredLevel,
  type CommunityShareInfo,
  type DocumentResponse,
} from '@livedocuments/api-schema';
import { dedupeInFlight } from '@liveworkspace/workbench/lib/dedupe';
import { indexClient } from '@liveworkspace/workbench/lib/index-client';
import {
  API_BASE,
  apiHeaders,
  expectOkOrNull,
  getSessionSharePassword,
  type SharedDocumentResolution,
  apiFetch,
} from './core';
import { documentGrant, documentGrantRefusal } from './document-grants';

// A refusal the password gate answers: none sent yet (401) or a wrong one (403).
function passwordRefusal(code: string | null): SharedDocumentResolution | null {
  if (code === 'password_required') return { passwordRequired: true, invalid: false };
  if (code === 'password_invalid') return { passwordRequired: true, invalid: true };
  return null;
}

// Resolve a share code to the document it opens, the level it grants and its tab. With the document's id (the address
// `/document/<id>?s=<code>` carries it) this is the grant, which the page asked for while its code loaded, and the
// document's one read; without it, the index resolves the code first. Null for a code that opens nothing.
async function _apiLoadShared(
  code: string,
  ownerId: string,
  documentId: string | null = null,
): Promise<SharedDocumentResolution | null> {
  const password = getSessionSharePassword();
  let id = documentId;
  if (!id) {
    try {
      id = (await indexClient.resolveShare(code, password)).item.id;
    } catch (err) {
      if (err instanceof IndexError) return passwordRefusal(err.code);
      throw err;
    }
  }
  const share = { code, password };
  const grant = await documentGrant(id, share, { fresh: true });
  if (!grant) return passwordRefusal(documentGrantRefusal(id, share));
  // A community link is a view link to every tab, so only such a link can be one: its post is asked beside the read.
  const maybeCommunity = grant.level === 'view' && grant.tabId === null;
  const [res, community] = await Promise.all([
    apiFetch(`${API_BASE}/documents/${encodeURIComponent(id)}`, {
      headers: await apiHeaders(ownerId, { share: code }),
    }),
    maybeCommunity ? apiLoadCommunityPostOf(code, ownerId) : Promise.resolve(null),
  ]);
  const body = await expectOkOrNull<DocumentResponse>(res, 'load shared');
  if (!body) return null;
  return {
    document: body.document,
    role: parseStoredLevel(grant.level),
    tabId: grant.tabId,
    community,
  };
}

// The Community post a link belongs to, or null for an ordinary link or when it can't be read (the link then opens as
// an ordinary view link, which the api already serves without comments when it is a community one).
async function apiLoadCommunityPostOf(
  code: string,
  ownerId: string,
): Promise<CommunityShareInfo | null> {
  try {
    const res = await apiFetch(`${API_BASE}/share/${encodeURIComponent(code)}`, {
      headers: await apiHeaders(ownerId, { share: null }),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { community?: unknown };
    return readCommunityShareInfo(body.community);
  } catch {
    return null;
  }
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

export const apiLoadShared = dedupeInFlight<
  [code: string, ownerId: string, documentId?: string | null],
  SharedDocumentResolution | null
>(_apiLoadShared, (code, ownerId, documentId) => `${code}|${ownerId}|${documentId ?? ''}`);
