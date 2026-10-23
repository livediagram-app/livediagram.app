// This Browser: what an app keeps only in this browser (its offline items), for the Explorer served on that app's own
// address (liveworkspace/docs/one-explorer.md "The Explorer on each app's address"). The index never sees these, and
// they live in the app's own storage, which only a page on the app's origin can read. So the app keeps a small list
// of them in localStorage under one shared key (`liveworkspace:this-browser:<app>`): id, title and the few dates the
// Explorer sorts and groups by, never their content. The Explorer page, on the same origin, reads it and hears each
// change; liveworkspace.app can't read it and keeps its link into the app instead.
//
// Plain TypeScript, no React: the apps' offline stores import it to write the list.

import type { App } from '@liveworkspace/index-client';

export type ThisBrowserItem = {
  id: string;
  title: string;
  createdAt: number;
  // Last content or title change.
  updatedAt: number;
  // The last time this browser opened it, for Home's Jump Back In; null when never.
  lastOpenedAt: number | null;
  // In the app's local Trash since then; null while live.
  trashedAt: number | null;
  favourite: boolean;
};

// The list is cut at this many, newest change first: a few dozen offline items is a heavy user, and the whole list
// is parsed on every change.
export const THIS_BROWSER_MAX = 500;
const VERSION = 1;

export const thisBrowserKey = (app: App) => `liveworkspace:this-browser:${app}`;

// The same tab's writes: a `storage` event only reaches other tabs.
const SAME_TAB_EVENT = 'liveworkspace:this-browser';

type Stored = { v: number; items: ThisBrowserItem[] };

function storage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

const num = (value: unknown, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;
const numOrNull = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

function clean(raw: unknown): ThisBrowserItem | null {
  const r = raw as Partial<Record<keyof ThisBrowserItem, unknown>> | null;
  if (!r || typeof r.id !== 'string' || !r.id) return null;
  const updatedAt = num(r.updatedAt, 0);
  return {
    id: r.id,
    title: typeof r.title === 'string' ? r.title : '',
    createdAt: num(r.createdAt, updatedAt),
    updatedAt,
    lastOpenedAt: numOrNull(r.lastOpenedAt),
    trashedAt: numOrNull(r.trashedAt),
    favourite: r.favourite === true,
  };
}

/** The list as this app last wrote it: newest change first, never more than THIS_BROWSER_MAX. */
export function readThisBrowser(app: App, store: Storage | null = storage()): ThisBrowserItem[] {
  let raw: string | null = null;
  try {
    raw = store?.getItem(thisBrowserKey(app)) ?? null;
  } catch {
    return [];
  }
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as Partial<Stored>;
    if (parsed.v !== VERSION || !Array.isArray(parsed.items)) return [];
    return parsed.items.flatMap((item) => clean(item) ?? []);
  } catch {
    return [];
  }
}

const newestFirst = (a: ThisBrowserItem, b: ThisBrowserItem) => b.updatedAt - a.updatedAt;

/** Replaces the whole list (the app's offline store, read once as it starts). */
export function writeThisBrowser(
  app: App,
  items: readonly ThisBrowserItem[],
  store: Storage | null = storage(),
): void {
  const kept = [...items].sort(newestFirst).slice(0, THIS_BROWSER_MAX);
  try {
    if (!store) return;
    if (kept.length === 0) store.removeItem(thisBrowserKey(app));
    else store.setItem(thisBrowserKey(app), JSON.stringify({ v: VERSION, items: kept }));
  } catch {
    // Storage full or blocked: the Explorer goes without This Browser, the app's own view still lists them.
    return;
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(SAME_TAB_EVENT, { detail: app }));
  }
}

const sameItem = (a: ThisBrowserItem, b: ThisBrowserItem) =>
  a.title === b.title &&
  a.createdAt === b.createdAt &&
  a.updatedAt === b.updatedAt &&
  a.lastOpenedAt === b.lastOpenedAt &&
  a.trashedAt === b.trashedAt &&
  a.favourite === b.favourite;

/** One item changed (written, renamed, trashed, restored, opened). */
export function putThisBrowserItem(
  app: App,
  item: ThisBrowserItem,
  store: Storage | null = storage(),
): void {
  const items = readThisBrowser(app, store);
  const kept = items.find((i) => i.id === item.id);
  // An autosave that changed nothing listed here writes nothing (and wakes no Explorer).
  if (kept && sameItem(kept, item)) return;
  writeThisBrowser(app, [item, ...items.filter((i) => i.id !== item.id)], store);
}

/** One item gone from this browser (deleted, or moved to the account). */
export function dropThisBrowserItem(app: App, id: string, store: Storage | null = storage()): void {
  const items = readThisBrowser(app, store);
  if (!items.some((i) => i.id === id)) return;
  writeThisBrowser(
    app,
    items.filter((i) => i.id !== id),
    store,
  );
}

/** Calls `onChange` when the list changes, in this tab or another. */
export function subscribeThisBrowser(app: App, onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const key = thisBrowserKey(app);
  const onStorage = (e: StorageEvent) => {
    if (e.key === key || e.key === null) onChange();
  };
  const onSameTab = (e: Event) => {
    if ((e as CustomEvent<App>).detail === app) onChange();
  };
  window.addEventListener('storage', onStorage);
  window.addEventListener(SAME_TAB_EVENT, onSameTab);
  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener(SAME_TAB_EVENT, onSameTab);
  };
}
