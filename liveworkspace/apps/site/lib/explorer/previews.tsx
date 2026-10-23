'use client';

// Item previews on liveworkspace.app's Explorer: each app that serves one (the sites registry's `previewPath`,
// liveplanner's plan snapshot today) is asked by the person's workspace token, which every app's API accepts, with
// the share code for an item reached through a link. An app that serves none, or an empty item, draws the kind's
// icon with no request at all.
//
// Cheap on purpose: a preview is asked for only once its box scrolls near the screen (or a row is hovered, by the
// Explorer's prefetch), at most PREVIEW_CONCURRENCY at a time, once per item version per page (in flight and
// settled requests are shared), and kept as blob URLs in a page-wide cache of PREVIEW_CACHE_MAX, least recently
// used out (each URL revoked as it goes). The app's answer is `private, max-age=86400` keyed by `?v=<updatedAt>`,
// so a reload reads from the browser's cache.

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import type { Item } from '@liveworkspace/index-client';
import type { RenderThumbnail } from '@liveworkspace/explorer';
import { APP_ITEMS, isAppName } from '@liveworkspace/sites';
import { appOrigin } from './page-app';
import { workspaceToken } from './token';

export const PREVIEW_CACHE_MAX = 200;
export const PREVIEW_CONCURRENCY = 4;
// Asked for this far before its box reaches the screen.
const ROOT_MARGIN = '200px';

type Entry = { status: 'ready'; src: string } | { status: 'none' };

/** The preview's address for an item, or null when its app serves none. */
export function previewUrl(item: Pick<Item, 'app' | 'id' | 'updatedAt'>): string | null {
  if (!isAppName(item.app)) return null;
  const path = APP_ITEMS[item.app].previewPath;
  if (!path) return null;
  const at = path.replace(':id', encodeURIComponent(item.id));
  return `${appOrigin(item.app)}${at}?v=${item.updatedAt}`;
}

const isEmpty = (item: Item) => (item.summary as { empty?: boolean } | null)?.empty === true;

// ---------- The page-wide cache --------------------------------------------------------------------------------

const entries = new Map<string, Entry>();
const inflight = new Map<string, Promise<Entry>>();
const listeners = new Set<() => void>();
let version = 0;
let running = 0;
const waiting: (() => void)[] = [];

function settle(key: string, entry: Entry) {
  entries.delete(key);
  entries.set(key, entry);
  while (entries.size > PREVIEW_CACHE_MAX) {
    const [oldest, gone] = entries.entries().next().value!;
    entries.delete(oldest);
    if (gone.status === 'ready') URL.revokeObjectURL(gone.src);
  }
  version++;
  for (const l of listeners) l();
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
  const key = `${url}|${item.sharedVia ?? ''}`;
  const hit = entries.get(key);
  if (hit) return Promise.resolve(hit);
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

function peek(item: Item): Entry | undefined {
  const url = previewUrl(item);
  return url ? entries.get(`${url}|${item.sharedVia ?? ''}`) : undefined;
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
  useEffect(() => {
    if (near && !entry) void loadPreview(item);
  }, [near, entry, item]);
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

/** The Explorer's previews: the app's own picture where it serves one, otherwise the kind's icon (null). */
export const renderPreview: RenderThumbnail = (item): ReactNode =>
  isEmpty(item) || !previewUrl(item) ? null : <Preview item={item} />;

/** Asked for ahead, when a row is pointed at, so its card opens with the picture. */
export const prefetchPreview = (item: Item) => void loadPreview(item);
