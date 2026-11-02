// Where previews are kept and when they are fresh (liveworkspace/docs/specs/006-media/previews.md "Storage", "Staleness"). One
// bucket, the service's own, under `previews/`: image ids never hold a slash, so the two never meet.
//
//   previews/<app>/<itemId>/<view>-<tab>[-<appearance>].svg   view: full | public; tab: first | <tabId>;
//                                                    appearance: the reader's, when they asked for one
//   previews/<app>/<itemId>/<view>-<tab>.png   the share card drawn from the SVG beside it
//
// Metadata: `v`, the item version the object is fresh for; `av`, the app's own content version it was drawn at;
// `e: '1'`, nothing to draw (a zero-byte object, so an empty item is asked of its app once per change).

import type { App } from '@liveworkspace/index-client';
import type { PreviewAppearance } from '@liveworkspace/media';
import { callDoor } from './door';

export const PREVIEWS_PREFIX = 'previews/';
const SVG_TYPE = 'image/svg+xml; charset=utf-8';

// What a preview is drawn for: the item, the version it must be fresh for, and the reader's view of it.
export type Subject = {
  app: App;
  itemId: string;
  // The index's `updatedAt`.
  version: number;
  tabId: string | null;
  // A public link's code: its app is asked every time whether it may still show anything.
  code: string | null;
  // The reader's appearance, drawn and stored on its own; null draws as the app does with no reader.
  appearance: PreviewAppearance | null;
};

export type Drawing =
  // `object` on a hit (the body unread), `svg` when just drawn.
  | { kind: 'svg'; av: string; object?: R2ObjectBody; svg?: string }
  | { kind: 'empty' }
  | { kind: 'missing' }
  | { kind: 'unavailable' };

export const itemPrefix = (app: App, itemId: string): string =>
  `${PREVIEWS_PREFIX}${app}/${encodeURIComponent(itemId)}/`;

const baseKey = (s: Subject): string =>
  `${itemPrefix(s.app, s.itemId)}${s.code ? 'public' : 'full'}-${s.tabId ? encodeURIComponent(s.tabId) : 'first'}${s.appearance ? `-${s.appearance}` : ''}`;

export const svgKey = (s: Subject): string => `${baseKey(s)}.svg`;
export const cardKey = (s: Subject): string => `${baseKey(s)}.png`;

export type Defer = (work: Promise<unknown>) => void;

function store(
  bucket: R2Bucket,
  key: string,
  body: string,
  meta: Record<string, string>,
  defer: Defer,
): void {
  defer(
    bucket
      .put(key, body, { httpMetadata: { contentType: SVG_TYPE }, customMetadata: meta })
      .catch((err: unknown) => {
        // Best effort: the drawing is still served; the next read draws it again.
        console.warn('[previews] write failed', { key, error: String(err) });
      }),
  );
}

const fromStore = (object: R2ObjectBody): Drawing =>
  object.customMetadata?.e === '1'
    ? { kind: 'empty' }
    : { kind: 'svg', av: object.customMetadata?.av ?? '', object };

/** The subject's drawing: from the bucket while fresh, else from its app's export door (and stored for next time,
 *  after the response, in `defer`). */
export async function drawing(
  env: { MEDIA?: R2Bucket } & Parameters<typeof callDoor>[0],
  subject: Subject,
  defer: Defer,
): Promise<Drawing> {
  const bucket = env.MEDIA;
  if (!bucket) return { kind: 'unavailable' };
  const key = svgKey(subject);
  const object = await bucket.get(key);
  const storedFor = Number(object?.customMetadata?.v ?? Number.NaN);
  // Fresh: drawn at or after the item's last change. A public link is always asked of its app.
  if (object && !subject.code && storedFor >= subject.version) return fromStore(object);

  const heldVersion = Number(object?.customMetadata?.av ?? Number.NaN);
  const answer = await callDoor(env, subject.app, {
    itemId: subject.itemId,
    tabId: subject.tabId,
    code: subject.code,
    appearance: subject.appearance,
    ifVersion: subject.code && object && Number.isFinite(heldVersion) ? heldVersion : null,
  });
  switch (answer.status) {
    case 'unchanged':
      if (object) return fromStore(object);
      return { kind: 'unavailable' };
    case 'ok': {
      await object?.body.cancel();
      const av = String(answer.version);
      const v = String(Math.max(subject.version, answer.version));
      store(bucket, key, answer.svg, { v, av }, defer);
      return { kind: 'svg', av, svg: answer.svg };
    }
    case 'empty': {
      await object?.body.cancel();
      const av = String(answer.version);
      const v = String(Math.max(subject.version, answer.version));
      store(bucket, key, '', { v, av, e: '1' }, defer);
      return { kind: 'empty' };
    }
    case 'not_found':
      await object?.body.cancel();
      return { kind: 'missing' };
    case 'error':
      console.warn('[previews] export door failed', {
        app: subject.app,
        itemId: subject.itemId,
        reason: answer.reason,
      });
      // A stale picture beats none, except for a public link, whose app must say yes each time.
      if (object && !subject.code) return fromStore(object);
      await object?.body.cancel();
      return { kind: 'unavailable' };
  }
}

/** The SVG text of a drawing (reading a stored one's body). */
export async function svgText(d: Extract<Drawing, { kind: 'svg' }>): Promise<string> {
  return d.svg ?? (await d.object!.text());
}

/** Every preview kept of one item, for its purge. Answers how many objects went. */
export async function deleteItemPreviews(
  bucket: R2Bucket,
  app: App,
  itemId: string,
): Promise<number> {
  const prefix = itemPrefix(app, itemId);
  let deleted = 0;
  let cursor: string | undefined;
  do {
    const page = await bucket.list({ prefix, cursor });
    const keys = page.objects.map((o) => o.key);
    if (keys.length > 0) await bucket.delete(keys);
    deleted += keys.length;
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return deleted;
}
