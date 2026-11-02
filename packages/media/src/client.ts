// The media service as an app's Worker calls it (liveworkspace/docs/specs/006-media/media.md "Using it from an app"):
// one typed method per route, each carrying the app's name and key. Answers that aren't a success come
// back as `{ ok: false, status, body }` rather than throwing, because most of them (a full gallery, an
// unsupported file) are answers the app passes on to its editor as they are.

import type { MediaApp } from './apps';
import {
  IMAGE_HEIGHT_HEADER,
  IMAGE_NAME_HEADER,
  IMAGE_SHA256_HEADER,
  MEDIA_DOCUMENT_HEADER,
  IMAGE_WIDTH_HEADER,
  MEDIA_API_URL,
  MEDIA_APP_HEADER,
  MEDIA_OWNER_HEADER,
  type MediaImageResponse,
  type MediaListResponse,
  type MediaMergeResponse,
  type MediaRefsSync,
  type MediaUploadResponse,
  type MediaUsageResponse,
} from './wire';

export type MediaResult<T> =
  | { ok: true; value: T }
  | { ok: false; status: number; body: { error: string } & Record<string, unknown> };

export type MediaUpload = {
  owner: string;
  bytes: ArrayBuffer | ReadableStream<Uint8Array>;
  contentType: string;
  byteSize: number;
  width: number;
  height: number;
  originalName?: string | null;
  // Only for the owner's own editor (see IMAGE_SHA256_HEADER).
  sha256?: string | null;
  // The document it is uploaded for, when the server holds that document (see MEDIA_DOCUMENT_HEADER).
  document?: string | null;
};

// The bytes of an image, and whose it is.
export type MediaBytes = { owner: string; contentType: string; body: ReadableStream | null };

export type MediaClientOptions = {
  app: MediaApp;
  key: string;
  // The service's API, when not production's (staging's, or a local one).
  url?: string | null;
  fetch?: typeof fetch;
};

export function createMediaClient({ app, key, url, fetch: doFetch = fetch }: MediaClientOptions) {
  const base = url || MEDIA_API_URL;
  const call = (path: string, init: RequestInit = {}, search?: Record<string, string>) => {
    const query = search ? `?${new URLSearchParams(search)}` : '';
    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${key}`);
    headers.set(MEDIA_APP_HEADER, app);
    return doFetch(`${base}/app${path}${query}`, { ...init, headers });
  };
  const json = async <T>(res: Response): Promise<MediaResult<T>> => {
    const body = (await res.json().catch(() => ({ error: 'invalid_body' }))) as never;
    return res.ok ? { ok: true, value: body as T } : { ok: false, status: res.status, body };
  };
  const send = (method: string, value: unknown): RequestInit => ({
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(value),
  });

  return {
    /** The owner's gallery, from every app, newest first. */
    list: async (owner: string) => json<MediaListResponse>(await call('/images', {}, { owner })),

    /** Store a file in the owner's gallery, or answer the one they already have with those bytes. */
    upload: async (input: MediaUpload) => {
      const headers = new Headers({
        'Content-Type': input.contentType,
        'Content-Length': String(input.byteSize),
        [IMAGE_WIDTH_HEADER]: String(input.width),
        [IMAGE_HEIGHT_HEADER]: String(input.height),
      });
      if (input.originalName)
        headers.set(IMAGE_NAME_HEADER, encodeURIComponent(input.originalName));
      if (input.sha256) headers.set(IMAGE_SHA256_HEADER, input.sha256);
      if (input.document) headers.set(MEDIA_DOCUMENT_HEADER, input.document);
      const res = await call(
        '/images',
        { method: 'POST', headers, body: input.bytes, duplex: 'half' } as RequestInit,
        { owner: input.owner },
      );
      return json<MediaUploadResponse>(res);
    },

    /** One image and its owner, or null when there is none. */
    get: async (id: string): Promise<MediaImageResponse | null> => {
      const res = await call(`/images/${encodeURIComponent(id)}`);
      if (res.status === 404) return null;
      const out = await json<MediaImageResponse>(res);
      if (!out.ok) throw new Error(`media: GET image answered ${out.status}`);
      return out.value;
    },

    /** An image's bytes and its owner, or null when there is none. The app decides who may see them. */
    bytes: async (id: string): Promise<MediaBytes | null> => {
      const res = await call(`/images/${encodeURIComponent(id)}/bytes`);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`media: GET bytes answered ${res.status}`);
      return {
        owner: res.headers.get(MEDIA_OWNER_HEADER) ?? '',
        contentType: res.headers.get('Content-Type') ?? 'application/octet-stream',
        body: res.body,
      };
    },

    /** Delete one of the owner's images. Documents that place it show a broken picture. */
    remove: async (owner: string, id: string) =>
      json<{ ok: true }>(
        await call(`/images/${encodeURIComponent(id)}`, { method: 'DELETE' }, { owner }),
      ),

    /** Which documents, in any app, place each of the owner's images. */
    usage: async (owner: string) => json<MediaUsageResponse>(await call('/usage', {}, { owner })),

    /** Tell the service which images each document places now. */
    syncRefs: async (sync: MediaRefsSync) =>
      json<{ ok: true }>(await call('/refs', send('POST', sync))),

    /** A guest signed up: move their images to the account. */
    mergeOwner: async (from: string, to: string) =>
      json<MediaMergeResponse>(await call('/owners/merge', send('POST', { from, to }))),

    /** An item purged: delete every preview the service keeps of it (liveworkspace/docs/specs/006-media/previews.md "Purging").
     *  Only this app's items. Answers how many objects went. */
    deletePreviews: async (itemId: string) =>
      json<{ deleted: number }>(
        await call(`/previews/${encodeURIComponent(itemId)}`, { method: 'DELETE' }),
      ),

    /** An account deleted: delete every image it uploaded, in every app. */
    forgetOwner: async (owner: string) =>
      json<{ deleted: number }>(
        await call(`/owners/${encodeURIComponent(owner)}`, { method: 'DELETE' }),
      ),
  };
}

export type MediaClient = ReturnType<typeof createMediaClient>;
