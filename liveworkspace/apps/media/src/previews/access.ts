// Who may see a preview (liveworkspace/docs/previews.md): the index decides, with the same rule it applies to the
// item itself. The service asks it once per request, through the INDEX service binding: one indexed read.

import {
  INDEX_API_URL,
  isApp,
  SHARE_CODE_HEADER,
  SHARE_PASSWORD_HEADER,
  type App,
  type ItemRead,
  type ShareResolution,
} from '@liveworkspace/index-client';
import type { Env } from '../env';

// What a preview needs to know about its item, as the caller reaches it.
export type PreviewItem = {
  app: App;
  id: string;
  title: string;
  // The index's last change of the item: the version a stored preview must be fresh for.
  updatedAt: number;
  // The item's summary says its first tab has nothing to draw.
  empty: boolean;
  // The one tab the caller's link confines them to.
  tabId: string | null;
  // The public link (a Community post's) the caller reaches it through, when that is their only way in.
  publicCode: string | null;
};

// `denied`: no such item, or no access (it answers as missing); `unavailable`: the index could not be asked.
export type Reach = PreviewItem | 'denied' | 'unavailable';

// How long the index may take before the preview gives up.
const INDEX_TIMEOUT_MS = 5_000;

function indexFetch(env: Env, path: string, headers: Headers): Promise<Response> {
  const base = (env.INDEX_URL || INDEX_API_URL).replace(/\/+$/, '');
  const init: RequestInit = { headers, signal: AbortSignal.timeout(INDEX_TIMEOUT_MS) };
  return env.INDEX ? env.INDEX.fetch(`${base}${path}`, init) : fetch(`${base}${path}`, init);
}

async function ask<T>(
  env: Env,
  path: string,
  headers: Headers,
): Promise<T | 'denied' | 'unavailable'> {
  let res: Response;
  try {
    res = await indexFetch(env, path, headers);
  } catch (err) {
    console.warn('[previews] index unreachable', String(err));
    return 'unavailable';
  }
  if (res.status >= 500) {
    await res.body?.cancel();
    return 'unavailable';
  }
  if (!res.ok) {
    await res.body?.cancel();
    return 'denied';
  }
  try {
    return (await res.json()) as T;
  } catch {
    return 'unavailable';
  }
}

function previewItem(
  item: ItemRead['item'],
  tabId: string | null,
  publicCode: string | null,
): PreviewItem | 'denied' {
  if (!isApp(item.app)) return 'denied';
  return {
    app: item.app,
    id: item.id,
    title: item.title,
    updatedAt: item.updatedAt,
    empty: item.summary?.empty === true,
    tabId,
    publicCode,
  };
}

// An item as the caller reaches it: their token, and the share code and password they came in by.
export async function reachItem(env: Env, request: Request, id: string): Promise<Reach> {
  const headers = new Headers();
  for (const name of ['Authorization', SHARE_CODE_HEADER, SHARE_PASSWORD_HEADER]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  const read = await ask<ItemRead>(env, `/items/${encodeURIComponent(id)}`, headers);
  if (read === 'denied' || read === 'unavailable') return read;
  return previewItem(read.item, read.tabId ?? null, read.publicCode ?? null);
}

// What a share link shows someone with nothing but its code: an anonymous resolve, so nothing is recorded for
// anyone. An unknown, revoked or expired code, an item in the Trash and an item behind a share password (an <img>
// cannot send one) are all `denied`.
export async function reachLink(env: Env, code: string): Promise<Reach> {
  const resolved = await ask<ShareResolution>(
    env,
    `/share/${encodeURIComponent(code)}`,
    new Headers(),
  );
  if (resolved === 'denied' || resolved === 'unavailable') return resolved;
  return previewItem(resolved.item, resolved.tabId, resolved.public ? code : null);
}
