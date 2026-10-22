// Tag calls (docs/specs/013-workspace/tags.md "API"): list / create / update / delete a tag, and put one on or take
// it off a document. Owner-scoped, guests included (apiHeaders attaches the account token when signed in, else
// X-Owner-Id).
//
// An offline document's tags live on its offline record, never on the server (the spec's "An offline document's tags
// live in the browser"), so the link calls dispatch on isOfflineId and the list merges the two, as favourites do.
import {
  TAG_ERRORS,
  TAG_LIMIT,
  type Tag,
  type TagLink,
  type TagsList,
} from '@liveplanner/api-schema';
import { dedupeInFlight } from '../dedupe';
import { isOfflineId, offlineListTagLinks, offlineSetDocumentTag } from '../offline/offline-store';
import { API_BASE, ApiError, apiFetch, apiHeaders, expectOk, expectOkVoid } from './core';

const tagUrl = (id: string) => `${API_BASE}/tags/${encodeURIComponent(id)}`;

// The account's tags and links alone, throwing when they could not be read. Take Offline needs to know rather than
// guess: a failed read taken as "no tags" would drop them with the server row.
export async function fetchCloudTags(ownerId: string): Promise<TagsList> {
  const res = await apiFetch(`${API_BASE}/tags`, { headers: await apiHeaders(ownerId) });
  const body = await expectOk<Partial<TagsList>>(res, 'list tags');
  if (!Array.isArray(body.tags) || !Array.isArray(body.links)) throw new Error('tags: malformed');
  return { tags: body.tags, links: body.links };
}

// Tags with every link, cloud and offline. Throws when the cloud read fails, so the caller can tell "no tags" from
// "couldn't load them"; the offline half has its own catch so no IndexedDB never takes the cloud half down. An offline
// link to a tag that no longer exists is dropped here.
async function _apiListTags(ownerId: string): Promise<TagsList> {
  const offline = offlineListTagLinks().catch((): TagLink[] => []);
  const cloud = await fetchCloudTags(ownerId);
  const known = new Set(cloud.tags.map((t) => t.id));
  return {
    tags: cloud.tags,
    links: [...cloud.links, ...(await offline).filter((l) => known.has(l.tagId))],
  };
}
// Deduped: the sidebar, the page and a panel can all ask for one owner at once.
export const apiListTags = dedupeInFlight(_apiListTags, (ownerId) => ownerId);

export async function apiCreateTag(
  ownerId: string,
  input: { id: string; name: string; colour: string },
): Promise<Tag> {
  const res = await apiFetch(`${API_BASE}/tags`, {
    method: 'POST',
    headers: await apiHeaders(ownerId, { body: true }),
    body: JSON.stringify(input),
  });
  return (await expectOk<{ tag: Tag }>(res, 'create tag')).tag;
}

export async function apiUpdateTag(
  ownerId: string,
  id: string,
  patch: { name?: string; colour?: string },
): Promise<Tag> {
  const res = await apiFetch(tagUrl(id), {
    method: 'PUT',
    headers: await apiHeaders(ownerId, { body: true }),
    body: JSON.stringify(patch),
  });
  return (await expectOk<{ tag: Tag }>(res, 'update tag')).tag;
}

export async function apiDeleteTag(ownerId: string, id: string): Promise<void> {
  const res = await apiFetch(tagUrl(id), { method: 'DELETE', headers: await apiHeaders(ownerId) });
  // Gone already (another tab) is what was asked for.
  if (res.status === 404) return;
  await expectOkVoid(res, 'delete tag');
}

// Put a tag on (`on`) or take it off a document. An offline document keeps it on its record.
export async function apiSetDocumentTag(
  ownerId: string,
  tagId: string,
  documentId: string,
  on: boolean,
): Promise<void> {
  if (await isOfflineId(documentId)) {
    await offlineSetDocumentTag(documentId, tagId, on);
    return;
  }
  const res = await apiFetch(`${tagUrl(tagId)}/documents/${encodeURIComponent(documentId)}`, {
    method: on ? 'PUT' : 'DELETE',
    headers: await apiHeaders(ownerId),
  });
  await expectOkVoid(res, on ? 'tag document' : 'untag document');
}

const TAG_SAVE_FAILED = "Couldn't save that tag change. Try again.";

/** What a failed tag write tells the person. */
export function tagErrorCopy(error: unknown): string {
  if (!(error instanceof ApiError)) return TAG_SAVE_FAILED;
  if (error.code === TAG_ERRORS.nameTaken) return 'You already have a tag with that name.';
  if (error.code === TAG_ERRORS.limit) {
    return `You have ${TAG_LIMIT} tags, the most there can be. Delete one to make room.`;
  }
  return TAG_SAVE_FAILED;
}
