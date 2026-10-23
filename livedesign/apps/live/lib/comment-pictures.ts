'use client';

// Comment authors' profile pictures (docs/specs/014-identity/profile-picture.md §5, §6). A reader
// never holds other people's comment author ids (they are owner ids, redacted by the api), so the
// api answers with comment id -> picture for the open tab, to signed-in readers only. Comment ids
// are UUIDs, so one page-wide map serves every tab. A tab is asked again only when it holds a
// comment the page has not asked about yet (a new comment), never on every render.

import { useEffect, useSyncExternalStore } from 'react';
import { isProfilePictureUrl } from '@livedesign/api-schema';
import type { CommentThread, Element } from '@livedesign/design';
import { useDeferredAuth } from '@/components/providers/deferred-auth';
import { API_BASE, apiFetch, apiHeaders } from '@/lib/api/core';
import { createListeners } from '@/lib/listeners';

const pictures = new Map<string, string>();
const asked = new Set<string>();
const listeners = createListeners();

function notify(): void {
  listeners.notify();
}

/** Test seam: forget everything. */
export function resetCommentPictures(): void {
  pictures.clear();
  asked.clear();
}

/** Every comment id in a tab's elements. */
function commentIdsOf(elements: readonly Element[] | undefined): string[] {
  const ids: string[] = [];
  for (const el of elements ?? []) {
    const thread = (el as { commentThread?: CommentThread }).commentThread;
    for (const c of thread?.comments ?? []) ids.push(c.id);
  }
  return ids;
}

async function load(
  designId: string,
  tabId: string,
  ids: string[],
  ownerId: string,
  shareCode: string | null,
) {
  for (const id of ids) asked.add(id);
  try {
    const res = await apiFetch(
      `${API_BASE}/designs/${designId}/tabs/${tabId}/comment-pictures`,
      { headers: await apiHeaders(ownerId, { share: shareCode }) },
    );
    if (!res.ok) return;
    const body = (await res.json()) as { pictures?: Record<string, unknown> };
    for (const [commentId, url] of Object.entries(body.pictures ?? {})) {
      if (isProfilePictureUrl(url)) pictures.set(commentId, url);
    }
    notify();
  } catch (err) {
    console.warn('[profile-picture] comment pictures failed', { error: String(err) });
  }
}

/** Keep the open tab's comment pictures loaded (signed-in readers only). */
export function useCommentPicturesLoader(
  designId: string | null | undefined,
  tabId: string | null | undefined,
  elements: readonly Element[] | undefined,
  // The code a share-link reader arrived with: their read access rides on it.
  shareCode: string | null,
): void {
  const { isSignedIn, userId } = useDeferredAuth();
  const unasked = commentIdsOf(elements).filter((id) => !asked.has(id));
  const key = unasked.join(',');
  useEffect(() => {
    if (!isSignedIn || !userId || !designId || !tabId || key === '') return;
    void load(designId, tabId, key.split(','), userId, shareCode);
  }, [isSignedIn, userId, designId, tabId, key, shareCode]);
}

/**
 * A comment author's picture: our own for our own comments (own chrome, spec §4), else what the
 * api reported for that comment, else null. Always null for an anonymous reader.
 */
export function useCommentAuthorPicture(commentId: string, authorId: string | undefined) {
  const { isSignedIn, userId, user } = useDeferredAuth();
  // The snapshot IS the value: read the map anywhere else and the React Compiler, which treats
  // module state as constant, memoizes the first answer for good.
  const reported = useSyncExternalStore(
    listeners.subscribe,
    () => pictures.get(commentId) ?? null,
    () => null,
  );
  if (!isSignedIn) return null;
  if (authorId && authorId === userId) return user?.pictureUrl ?? null;
  return reported;
}
