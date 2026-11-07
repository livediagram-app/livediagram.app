'use client';

// A connected tab's picture (liveworkspace/docs/specs/004-index/connected-tabs.md "How it looks", IDX38): the page asks
// the index where the tab leads, as Open would but going nowhere, and fetches the picture its answer names (`preview`,
// on this page's own origin: the item's for its own people, the pass's live image for everyone else). Asked once per
// connection per page: answers are held page-wide, least recently used out past CONNECTED_PREVIEW_CACHE_MAX, each
// blob URL revoked as it goes, and a page mounting while one is in flight shares it. Offline it asks nothing. Any
// refusal or failure is `none`: the card shows the logo alone, and Open still says why.
import { useEffect, useRef, useState } from 'react';
import type { IndexClient, TabConnection } from '@liveworkspace/index-client';
import { indexClient } from '../../lib/index-client';
import { workbench } from '../../bindings';

export const CONNECTED_PREVIEW_CACHE_MAX = 24;

export type ConnectedPreview =
  { state: 'loading' } | { state: 'ready'; src: string } | { state: 'none' };

type Settled = Exclude<ConnectedPreview, { state: 'loading' }>;

const settled = new Map<string, Settled>();
const inflight = new Map<string, Promise<Settled>>();

const NONE: Settled = { state: 'none' };
const LOADING: ConnectedPreview = { state: 'loading' };

// The reader's half: an item's picture is drawn in the appearance the page is in.
const appearanceNow = (): 'light' | 'dark' =>
  typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
    ? 'dark'
    : 'light';

function keep(key: string, entry: Settled) {
  settled.delete(key);
  settled.set(key, entry);
  for (const [old, held] of settled) {
    if (settled.size <= CONNECTED_PREVIEW_CACHE_MAX) break;
    settled.delete(old);
    if (held.state === 'ready') URL.revokeObjectURL(held.src);
  }
}

async function ask(
  connectionId: string,
  appearance: 'light' | 'dark',
  grant: () => Promise<string | null>,
  client: Pick<IndexClient, 'openConnection'>,
): Promise<Settled> {
  const held = await grant();
  if (!held) return NONE;
  const open = await client.openConnection(connectionId, held);
  if (!open.preview) return NONE;
  const url = new URL(open.preview, window.location.origin);
  if (open.via === 'item') url.searchParams.set('appearance', appearance);
  const headers = new Headers();
  const bearer = open.via === 'item' ? await workbench.api.currentBearer() : null;
  if (bearer) headers.set('Authorization', `Bearer ${bearer}`);
  const res = await fetch(url, { headers });
  if (!res.ok) return NONE;
  const blob = await res.blob();
  if (blob.size === 0) return NONE;
  return { state: 'ready', src: URL.createObjectURL(blob) };
}

function load(
  connectionId: string,
  appearance: 'light' | 'dark',
  grant: () => Promise<string | null>,
  client: Pick<IndexClient, 'openConnection'>,
): Promise<Settled> {
  const key = keyOf(connectionId, appearance);
  const hit = settled.get(key);
  if (hit) {
    // Used again, so the most recent: to the newest end.
    keep(key, hit);
    return Promise.resolve(hit);
  }
  let pending = inflight.get(key);
  if (!pending) {
    pending = ask(connectionId, appearance, grant, client).then(
      (entry) => {
        inflight.delete(key);
        keep(key, entry);
        return entry;
      },
      // A failure is not kept: the next page to ask tries again.
      () => {
        inflight.delete(key);
        return NONE;
      },
    );
    inflight.set(key, pending);
  }
  return pending;
}

const keyOf = (connectionId: string, appearance: 'light' | 'dark') =>
  `${connectionId}|${appearance}`;

export function useConnectedPreview({
  connection,
  grant,
  offline,
  client = indexClient,
}: {
  connection: TabConnection;
  grant: () => Promise<string | null>;
  offline: boolean;
  client?: Pick<IndexClient, 'openConnection'>;
}): ConnectedPreview {
  const { id } = connection;
  const appearance = appearanceNow();
  const key = keyOf(id, appearance);
  const [answer, setAnswer] = useState<{ key: string; entry: Settled } | null>(null);
  // The grant and client are read when it asks, so a new function from a re-render never asks again.
  const doors = useRef({ grant, client });
  useEffect(() => {
    doors.current = { grant, client };
  });
  useEffect(() => {
    if (offline) return;
    let live = true;
    void load(id, appearance, doors.current.grant, doors.current.client).then((entry) => {
      if (live) setAnswer({ key, entry });
    });
    return () => {
      live = false;
    };
  }, [id, appearance, key, offline]);
  if (offline) return NONE;
  if (answer?.key === key) return answer.entry;
  // Settled for another page already: drawn at once, with no placeholder first.
  return settled.get(key) ?? LOADING;
}

/** For tests: forget every answer. */
export function resetConnectedPreviews() {
  for (const entry of settled.values()) if (entry.state === 'ready') URL.revokeObjectURL(entry.src);
  settled.clear();
  inflight.clear();
}
