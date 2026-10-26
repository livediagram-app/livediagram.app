'use client';

// Item previews in the Explorer (liveworkspace/docs/previews.md): one address for every app's items,
// `/api/previews/items/<id>` on the page's own origin (liveworkspace.app's media service, which each app's router
// forwards to), asked with the page's token, and the share code for an item reached through a link. The service asks
// the index whether the reader may see the item, so a preview is never more visible than the item. An empty item
// draws the kind's icon with no request at all.
//
// Cheap on purpose: a preview is asked for only once its box scrolls near the screen (or a row is hovered, by the
// Explorer's prefetch), at most PREVIEW_CONCURRENCY at a time, once per item version per page (in flight and
// settled requests are shared), and kept as blob URLs in a page-wide cache of PREVIEW_CACHE_MAX, least recently
// used out (each URL revoked as it goes). A preview whose box is mounted is never the one to go: the cache grows to
// hold every mounted box (up to PREVIEW_CACHE_CEILING), so a grid of more than PREVIEW_CACHE_MAX cards does not evict
// and refetch its own pictures in a loop, and shrinks back as boxes unmount. The answer is `private, max-age=86400` keyed by `?v=<updatedAt>`, so a
// reload reads from the browser's cache. Same-origin, so no CORS preflight per item.

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import type { Item } from '@liveworkspace/index-client';
import type { RenderThumbnail } from '@liveworkspace/explorer';
import { PREVIEWS_PATH } from '@liveworkspace/sites/workspace-proxy';
import { workspaceToken } from './token';

export const PREVIEW_CACHE_MAX = 200;
// The most it ever holds, mounted boxes or not: past it the least recently used goes even if on screen.
export const PREVIEW_CACHE_CEILING = 1000;
export const PREVIEW_CONCURRENCY = 4;
// Asked for this far before its box reaches the screen.
const ROOT_MARGIN = '200px';

type Entry = { status: 'ready'; src: string } | { status: 'none' };

/** The preview's address for an item, whatever its app: on this page's own origin. */
export function previewUrl(item: Pick<Item, 'id' | 'updatedAt'>): string {
  return `${PREVIEWS_PATH}/items/${encodeURIComponent(item.id)}?v=${item.updatedAt}`;
}

const isEmpty = (item: Item) => (item.summary as { empty?: boolean } | null)?.empty === true;

// ---------- The page-wide cache --------------------------------------------------------------------------------

const entries = new Map<string, Entry>();
// How many mounted boxes show each key: those entries are kept while the cache has room under the ceiling.
const mounted = new Map<string, number>();
const inflight = new Map<string, Promise<Entry>>();
const listeners = new Set<() => void>();
let version = 0;
let running = 0;
const waiting: (() => void)[] = [];

function drop(key: string, entry: Entry) {
  entries.delete(key);
  if (entry.status === 'ready') URL.revokeObjectURL(entry.src);
}

// Least recently used out, down to PREVIEW_CACHE_MAX or the mounted boxes' count, whichever is more (capped at the
// ceiling). Mounted entries are skipped unless only the ceiling is left to keep. Answers whether any went.
function trim(): boolean {
  const room = Math.min(PREVIEW_CACHE_CEILING, Math.max(PREVIEW_CACHE_MAX, mounted.size));
  if (entries.size <= room) return false;
  let excess = entries.size - room;
  for (const [key, entry] of entries) {
    if (excess === 0) break;
    if (mounted.has(key)) continue;
    drop(key, entry);
    excess--;
  }
  // Every one left is on screen and still over the ceiling: the oldest go.
  for (const [key, entry] of entries) {
    if (excess === 0) break;
    drop(key, entry);
    excess--;
  }
  return true;
}

function settle(key: string, entry: Entry) {
  entries.delete(key);
  entries.set(key, entry);
  trim();
  version++;
  for (const l of listeners) l();
}

function mount(key: string): () => void {
  mounted.set(key, (mounted.get(key) ?? 0) + 1);
  return () => {
    const n = (mounted.get(key) ?? 1) - 1;
    if (n > 0) mounted.set(key, n);
    else mounted.delete(key);
    // Nothing on screen needs the room now: back down to size (no redraw, nothing mounted shows these).
    trim();
  };
}

function slot(): Promise<void> {
  if (running < PREVIEW_CONCURRENCY) {
    running++;
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => waiting.push(resolve)).then(() => {
    running++;
  });
}

function release() {
  running--;
  waiting.shift()?.();
}

async function fetchPreview(url: string, shareCode: string | null): Promise<Entry> {
  await slot();
  try {
    const token = await workspaceToken();
    const headers = new Headers();
    if (token) headers.set('Authorization', `Bearer ${token}`);
    if (shareCode) headers.set('X-Share-Code', shareCode);
    const res = await fetch(url, { headers });
    if (!res.ok) return { status: 'none' };
    return { status: 'ready', src: URL.createObjectURL(await res.blob()) };
  } finally {
    release();
  }
}

/** The item's preview, fetched once per version however many boxes ask; null when it has none. */
export function loadPreview(item: Item): Promise<Entry> | null {
  const url = isEmpty(item) ? null : previewUrl(item);
  if (!url) return null;
  const key = keyOf(item);
  const hit = entries.get(key);
  if (hit) {
    // Asked again, so the most recently used: to the newest end, so the cache drops the least recently used.
    entries.delete(key);
    entries.set(key, hit);
    return Promise.resolve(hit);
  }
  let pending = inflight.get(key);
  if (!pending) {
    pending = fetchPreview(url, item.sharedVia ?? null).then(
      (entry) => {
        inflight.delete(key);
        settle(key, entry);
        return entry;
      },
      // A failed request isn't kept: the next box to ask tries again.
      () => {
        inflight.delete(key);
        return { status: 'none' };
      },
    );
    inflight.set(key, pending);
  }
  return pending;
}

const keyOf = (item: Item) => `${previewUrl(item)}|${item.sharedVia ?? ''}`;

function peek(item: Item): Entry | undefined {
  return entries.get(keyOf(item));
}

/** For tests: how many previews are held. */
export function previewCacheSize(): number {
  return entries.size;
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** For tests: forget every preview. */
export function resetPreviews() {
  for (const e of entries.values()) if (e.status === 'ready') URL.revokeObjectURL(e.src);
  entries.clear();
  inflight.clear();
  mounted.clear();
  running = 0;
  waiting.length = 0;
}

// ---------- Drawing one ---------------------------------------------------------------------------------------

function Preview({ item }: { item: Item }) {
  useSyncExternalStore(
    subscribe,
    () => version,
    () => version,
  );
  const box = useRef<HTMLSpanElement>(null);
  const [near, setNear] = useState(false);
  const entry = peek(item);
  const key = keyOf(item);
  // Held while this box is mounted, so the cache never evicts what is on screen.
  useEffect(() => mount(key), [key]);
  useEffect(() => {
    if (entry || near) return;
    const el = box.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setNear(true);
      return;
    }
    const seen = new IntersectionObserver(
      (records) => {
        if (records.some((r) => r.isIntersecting)) {
          setNear(true);
          seen.disconnect();
        }
      },
      { rootMargin: ROOT_MARGIN },
    );
    seen.observe(el);
    return () => seen.disconnect();
  }, [entry, near]);
  // Asked once per version while mounted: a box whose picture went past the ceiling stays empty rather than asking
  // again, so even thousands of mounted boxes never refetch in a loop.
  const asked = useRef<string | null>(null);
  useEffect(() => {
    if (!near || entry || asked.current === key) return;
    asked.current = key;
    void loadPreview(item);
  }, [near, entry, item, key]);
  return (
    <span ref={box} data-app-preview={item.app} className="block h-full w-full">
      {entry?.status === 'ready' ? (
        <img
          src={entry.src}
          alt=""
          draggable={false}
          className="h-full w-full object-cover object-top"
        />
      ) : null}
    </span>
  );
}

/** The Explorer's previews: the item's picture, or the kind's icon (null) for an empty item. */
export const renderPreview: RenderThumbnail = (item): ReactNode =>
  isEmpty(item) ? null : <Preview item={item} />;

/** Asked for ahead, when a row is pointed at, so its card opens with the picture. */
export const prefetchPreview = (item: Item) => void loadPreview(item);
