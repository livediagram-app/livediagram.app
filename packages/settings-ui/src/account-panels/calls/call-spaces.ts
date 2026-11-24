'use client';

// Settings › Calls' data (liveworkspace/docs/specs/004-index/item-calls.md "Your Calls Space"): the Spaces a person may
// choose, and each one's preview. Plain helpers and one hook, apart from the panel so a test reads them alone.
import { useEffect, useState } from 'react';
import { CALL_SPACES_LISTED, type Item } from '@liveworkspace/index-client';
import { PREVIEWS_PATH } from '@liveworkspace/sites/workspace-proxy';

/** Spaces the person may choose: livehuddle's, theirs or their team's (edit, never through someone's link), out of
 *  the Trash and Archived, the most recently changed first, at most CALL_SPACES_LISTED. */
export function choosableSpaces(items: readonly Item[]): Item[] {
  return items
    .filter(
      (item) =>
        item.app === 'livehuddle' &&
        item.access === 'edit' &&
        item.sharedVia === null &&
        item.trashedAt === null &&
        !item.archivedAt,
    )
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, CALL_SPACES_LISTED);
}

/** Whether the stored choice is one the person can't choose now: not listed, while the list is whole. */
export function isUnavailable(value: string | null, spaces: readonly Item[]): boolean {
  if (value === null) return false;
  if (spaces.some((space) => space.id === value)) return false;
  return spaces.length < CALL_SPACES_LISTED;
}

/** Words a search matches a Space by, folded: its title. */
export function matchesSpace(item: Pick<Item, 'title'>, query: string): boolean {
  const q = query.trim().toLocaleLowerCase();
  return q === '' || (item.title || 'Untitled').toLocaleLowerCase().includes(q);
}

// The previews service draws each Space in the reader's appearance (liveworkspace/docs/specs/006-media/previews.md).
const appearanceNow = (): 'light' | 'dark' =>
  typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
    ? 'dark'
    : 'light';

/** A Space's preview address on this page's own origin. */
export const spacePreviewUrl = (
  item: Pick<Item, 'id' | 'updatedAt'>,
  appearance = appearanceNow(),
) =>
  `${PREVIEWS_PATH}/items/${encodeURIComponent(item.id)}?v=${item.updatedAt}&appearance=${appearance}`;

// At most this many asked for at once: the browser's cache answers a reopen (max-age a day).
export const PREVIEWS_AT_ONCE = 3;

/** The previews of `items`, by id, as blob URLs once each arrives (none for an empty Space or a refusal). Asked with
 *  the bearer, PREVIEWS_AT_ONCE at a time; every URL is revoked and every request dropped when the panel goes or the
 *  list changes. */
export function useSpacePreviews(
  items: readonly Pick<Item, 'id' | 'updatedAt' | 'summary'>[],
  token: () => Promise<string | null>,
): ReadonlyMap<string, string> {
  const [previews, setPreviews] = useState<ReadonlyMap<string, string>>(new Map());
  const key = items.map((item) => `${item.id}:${item.updatedAt}`).join(',');
  useEffect(() => {
    const abort = new AbortController();
    const made: string[] = [];
    const queue = items.filter(
      (item) => (item.summary as { empty?: boolean } | null)?.empty !== true,
    );
    const one = async (item: (typeof queue)[number]) => {
      const bearer = await token();
      if (!bearer || abort.signal.aborted) return;
      const res = await fetch(spacePreviewUrl(item), {
        headers: { authorization: `Bearer ${bearer}` },
        credentials: 'omit',
        signal: abort.signal,
      });
      if (!res.ok || !(res.headers.get('content-type') ?? '').startsWith('image/')) return;
      const blob = await res.blob();
      if (abort.signal.aborted) return;
      const url = URL.createObjectURL(blob);
      made.push(url);
      setPreviews((was) => new Map(was).set(item.id, url));
    };
    const worker = async () => {
      for (let next = queue.shift(); next && !abort.signal.aborted; next = queue.shift()) {
        await one(next).catch(() => undefined);
      }
    };
    void Promise.all(Array.from({ length: PREVIEWS_AT_ONCE }, worker));
    return () => {
      abort.abort();
      for (const url of made) URL.revokeObjectURL(url);
      setPreviews(new Map());
    };
    // `key` stands for the items; `token` is the host's, stable for the panel's life.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return previews;
}
