// The media service's walkthrough routes as an app's Worker calls them (liveworkspace/docs/specs/006-media/
// walkthroughs.md "The service's routes"), for `createMediaClient().walkthroughs`. Answers that aren't a success come
// back as `{ ok: false, status, body }`, which the door passes on.

import type {
  Walkthrough,
  WalkthroughEvents,
  WalkthroughLimits,
  WalkthroughStart,
} from './walkthrough';
import { MEDIA_ITEM_OWNER_HEADER } from './wire';

export const WALKTHROUGHS_PATH = '/walkthroughs';

export type WalkthroughResult<T> =
  | { ok: true; value: T }
  | { ok: false; status: number; body: { error: string } & Record<string, unknown> };

export type WalkthroughListResponse = {
  walkthroughs: { walkthrough: Walkthrough; owner: string }[];
  // With Pro on, and a recorder named: what they may record on the item (walkthroughs.md "With Pro on").
  limits?: WalkthroughLimits;
};

/** Who a list's limits are for: the recorder (a media owner) and the owner scope of the item, from the app's grant. */
export type WalkthroughRecorder = { owner: string; itemOwner?: string | null };
export type WalkthroughReadResponse = {
  walkthrough: Walkthrough;
  owner: string;
  events: WalkthroughEvents;
};

/** Its media's bytes, or null when there is none. */
export type WalkthroughMedia = {
  contentType: string;
  length: number | null;
  body: ReadableStream | null;
};

/** How the service is reached: the client's authorised call, answered as fetch answers. */
export type WalkthroughCall = (
  path: string,
  init?: RequestInit,
  search?: Record<string, string>,
) => Promise<Response>;

type FixedLengthStreamClass = new (length: number) => TransformStream<Uint8Array, Uint8Array>;

/**
 * A stream body as a Worker sends it with its length: the runtime drops a Content-Length header set by hand and sends
 * a stream chunked, which the service refuses (it holds the upload to the declared length). Workers have
 * FixedLengthStream for this; elsewhere (tests, Node) the body goes as it is.
 */
export function fixedLength(
  body: ReadableStream<Uint8Array> | ArrayBuffer,
  length: number,
): ReadableStream<Uint8Array> | ArrayBuffer {
  const Fixed = (globalThis as { FixedLengthStream?: FixedLengthStreamClass }).FixedLengthStream;
  if (!Fixed || body instanceof ArrayBuffer) return body;
  return body.pipeThrough(new Fixed(length));
}

export function walkthroughCalls(call: WalkthroughCall) {
  const json = async <T>(res: Response): Promise<WalkthroughResult<T>> => {
    const body = (await res.json().catch(() => ({ error: 'invalid_body' }))) as never;
    return res.ok ? { ok: true, value: body as T } : { ok: false, status: res.status, body };
  };
  const at = (id: string, rest = '') => `${WALKTHROUGHS_PATH}/${encodeURIComponent(id)}${rest}`;
  return {
    /** An item's ready walkthroughs, newest first, each with whose it is. With `recorder`, and Pro on at the service,
     *  the answer also carries what that person may record there. */
    list: async (item: string, recorder?: WalkthroughRecorder | null) =>
      json<WalkthroughListResponse>(
        recorder
          ? await call(
              WALKTHROUGHS_PATH,
              recorder.itemOwner
                ? { headers: { [MEDIA_ITEM_OWNER_HEADER]: recorder.itemOwner } }
                : {},
              { item, for: recorder.owner },
            )
          : await call(WALKTHROUGHS_PATH, {}, { item }),
      ),

    /** A person's own ready walkthroughs in this app, newest first (the Explorer's Walkthroughs library). */
    listOwned: async (owner: string) =>
      json<WalkthroughListResponse>(await call(WALKTHROUGHS_PATH, {}, { owner })),

    /** Start one: its events are stored at once; it is ready once its media arrives. */
    start: async (owner: string, start: WalkthroughStart, itemOwner?: string | null) =>
      json<{ walkthrough: Walkthrough }>(
        await call(
          WALKTHROUGHS_PATH,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(itemOwner ? { [MEDIA_ITEM_OWNER_HEADER]: itemOwner } : {}),
            },
            body: JSON.stringify(start),
          },
          { owner },
        ),
      ),

    /** Its media, streamed through as it arrives: exactly the declared length and type. */
    upload: async (
      owner: string,
      id: string,
      media: { body: ReadableStream<Uint8Array> | ArrayBuffer; type: string; length: number },
    ) =>
      json<{ walkthrough: Walkthrough }>(
        await call(
          at(id, '/media'),
          {
            method: 'PUT',
            headers: { 'Content-Type': media.type, 'Content-Length': String(media.length) },
            body: fixedLength(media.body, media.length),
            duplex: 'half',
          } as RequestInit,
          { owner },
        ),
      ),

    /** A ready one, whose it is and its events, or null when there is none. */
    read: async (id: string): Promise<WalkthroughResult<WalkthroughReadResponse> | null> => {
      const res = await call(at(id));
      return res.status === 404 ? null : json<WalkthroughReadResponse>(res);
    },

    /** Its media's bytes, or null when there are none on that item. */
    media: async (id: string, item: string): Promise<WalkthroughMedia | null> => {
      const res = await call(at(id, '/media'), {}, { item });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`media: GET walkthrough media answered ${res.status}`);
      const length = Number(res.headers.get('Content-Length'));
      return {
        contentType: res.headers.get('Content-Type') ?? 'application/octet-stream',
        length: Number.isFinite(length) && length > 0 ? length : null,
        body: res.body,
      };
    },

    /** Delete one: as its owner, or for an Editor of its item (the app has checked). */
    remove: async (id: string, by: { owner: string } | { item: string }) =>
      json<{ ok: true }>(await call(at(id), { method: 'DELETE' }, by)),

    /** Rename one: as its owner, or for an Editor of its item (the app has checked). */
    rename: async (id: string, by: { owner: string } | { item: string }, title: string) =>
      json<{ walkthrough: Walkthrough }>(
        await call(
          at(id),
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title }),
          },
          by,
        ),
      ),

    /** Turn its public link on (a new code) or off, as its owner or for an Editor of its item. */
    share: async (id: string, by: { owner: string } | { item: string }, on: boolean) =>
      json<{ walkthrough: Walkthrough }>(
        await call(at(id, '/share'), { method: on ? 'PUT' : 'DELETE' }, by),
      ),

    /** An item purged: every walkthrough on it goes. */
    purge: async (item: string) =>
      json<{ deleted: number }>(await call(WALKTHROUGHS_PATH, { method: 'DELETE' }, { item })),
  };
}

export type WalkthroughCalls = ReturnType<typeof walkthroughCalls>;
