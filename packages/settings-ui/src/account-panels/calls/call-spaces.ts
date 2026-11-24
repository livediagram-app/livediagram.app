'use client';

// Settings › Calls' data (liveworkspace/docs/specs/004-index/item-calls.md "Your Calls Space"): the Spaces a person may
// choose, and each one's preview. Plain helpers and one hook, apart from the panel so a test reads them alone.
import { useCallback, useEffect, useRef, useState } from 'react';
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

// A card's preview is asked for once it comes this near the screen.
export const PREVIEW_ROOT_MARGIN = '200px';

type Wanted = Pick<Item, 'id' | 'updatedAt' | 'summary'>;

/** The previews' fetcher: each Space version asked for once, PREVIEWS_AT_ONCE at a time, with the bearer. `stop` drops
 *  every request and revokes every URL it made. */
function previewLoader(
  token: () => Promise<string | null>,
  ready: (id: string, url: string) => void,
) {
  const asked = new Set<string>();
  const queue: Wanted[] = [];
  const made: string[] = [];
  const abort = new AbortController();
  let running = 0;
  const one = async (item: Wanted) => {
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
    ready(item.id, url);
  };
  const pump = () => {
    while (running < PREVIEWS_AT_ONCE && queue.length > 0 && !abort.signal.aborted) {
      const item = queue.shift()!;
      running += 1;
      void one(item)
        .catch(() => undefined)
        .finally(() => {
          running -= 1;
          pump();
        });
    }
  };
  return {
    want(item: Wanted) {
      const key = `${item.id}:${item.updatedAt}`;
      if (asked.has(key) || (item.summary as { empty?: boolean } | null)?.empty === true) return;
      asked.add(key);
      queue.push(item);
      pump();
    },
    stop() {
      abort.abort();
      for (const url of made) URL.revokeObjectURL(url);
    },
  };
}

/** The previews of `items`, by id, as blob URLs once each arrives (none for an empty Space or a refusal), and `watch`,
 *  the ref each card's picture puts on itself: a card's preview is asked for only once it comes within
 *  PREVIEW_ROOT_MARGIN of the screen (one IntersectionObserver for the panel; every card at once where the browser has
 *  none). Each version is asked once for the panel's life, so a search or Show All reuses what came; every URL is
 *  revoked, every request dropped and the observer disconnected when the panel goes. */
export function useSpacePreviews(
  items: readonly Wanted[],
  token: () => Promise<string | null>,
): { previews: ReadonlyMap<string, string>; watch: (id: string) => (el: Element | null) => void } {
  const [previews, setPreviews] = useState<ReadonlyMap<string, string>>(() => new Map());
  const byId = useRef(new Map<string, Wanted>());
  byId.current = new Map(items.map((item) => [item.id, item]));
  const tokenRef = useRef(token);
  tokenRef.current = token;
  const live = useRef<{
    loader: ReturnType<typeof previewLoader>;
    observer: IntersectionObserver | null;
  } | null>(null);
  // The cards on screen now, by id, so the observer made after them (refs come before effects) finds them.
  const cards = useRef(new Map<string, Element>());
  const watchers = useRef(new Map<string, (el: Element | null) => void>());

  const see = (id: string) => {
    const item = byId.current.get(id);
    if (item) live.current?.loader.want(item);
  };

  useEffect(() => {
    const loader = previewLoader(
      () => tokenRef.current(),
      (id, url) => setPreviews((was) => new Map(was).set(id, url)),
    );
    const observer =
      typeof IntersectionObserver === 'undefined'
        ? null
        : new IntersectionObserver(
            (entries) => {
              for (const entry of entries) {
                if (!entry.isIntersecting) continue;
                const id = (entry.target as HTMLElement).dataset.previewFor;
                if (id) see(id);
              }
            },
            { rootMargin: PREVIEW_ROOT_MARGIN },
          );
    live.current = { loader, observer };
    for (const [id, el] of cards.current) {
      if (observer) observer.observe(el);
      else see(id);
    }
    return () => {
      observer?.disconnect();
      loader.stop();
      live.current = null;
    };
    // Once for the panel's life: what it reads is kept in refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A Space shown again in a new version (its picture changed) is asked for again when next in view.
  const versions = items.map((item) => `${item.id}:${item.updatedAt}`).join(',');
  useEffect(() => {
    const observer = live.current?.observer;
    for (const [id, el] of cards.current) {
      if (!observer) see(id);
      else {
        observer.unobserve(el);
        observer.observe(el);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [versions]);

  const watch = useCallback((id: string) => {
    let ref = watchers.current.get(id);
    if (!ref) {
      ref = (el: Element | null) => {
        const was = cards.current.get(id);
        if (was && was !== el) {
          live.current?.observer?.unobserve(was);
          cards.current.delete(id);
        }
        if (!el) return;
        cards.current.set(id, el);
        const now = live.current;
        if (!now) return;
        if (now.observer) now.observer.observe(el);
        else see(id);
      };
      watchers.current.set(id, ref);
    }
    return ref;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { previews, watch };
}
