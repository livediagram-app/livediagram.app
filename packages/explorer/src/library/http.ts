// The Library's hosts over an app's API (the sites registry's `imagesPath` and `shapeLibrariesPath`): the person's
// images (`GET`/`POST`, `GET usage`, `GET`/`DELETE <id>`; the media service behind it) and their shape libraries
// (`GET`, `PUT`/`DELETE <id>`, `GET <id>/previews`; a Durable Object behind it), read by a bearer every app's API accepts. liveworkspace.app
// reads them cross-origin with the workspace token; an app's editor passes its own origin and token. Nothing is
// stored here. A shape is drawn by the app's API (one request a library, its every shape as an SVG), since drawing one
// takes the app's renderer.

import { createElement } from 'react';
import { APP_ITEMS, siteOfApp, type AppName } from '@liveworkspace/sites';
import { ShapePreview } from './ShapePreview';
import type {
  GalleryHost,
  GalleryImage,
  GalleryUse,
  LibraryShape,
  ShapeLibrariesHost,
  ShapeLibrary,
} from './types';

const ACCEPTED = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

class LibraryError extends Error {
  readonly status: number;
  readonly code: string | null;
  constructor(status: number, code: string | null) {
    super(`library: ${status}${code ? ` ${code}` : ''}`);
    this.status = status;
    this.code = code;
  }
}

type Token = () => Promise<string | null>;

async function call(
  token: Token,
  url: string,
  init: RequestInit = {},
  signal?: AbortSignal,
): Promise<Response> {
  const bearer = await token();
  const headers = new Headers(init.headers);
  if (bearer) headers.set('Authorization', `Bearer ${bearer}`);
  const res = await fetch(url, { ...init, headers, signal });
  if (!res.ok && res.status !== 503) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new LibraryError(res.status, body?.error ?? null);
  }
  return res;
}

/** What an upload refusal says. */
export function uploadRefusal(e: unknown): string {
  const code = e instanceof LibraryError ? e.code : null;
  switch (code) {
    case 'unsupported_type':
      return 'That file type isn’t supported. Use a PNG, JPEG, WebP or GIF.';
    case 'file_too_large':
      return 'That image is too large.';
    case 'gallery_full':
      return 'Your gallery is full. Delete an image to make room.';
    default:
      return 'Upload failed.';
  }
}

type WireImage = {
  id: string;
  contentType: string;
  byteSize: number;
  width: number;
  height: number;
  originalName?: string;
  createdAt: number;
};

async function imageSize(file: File): Promise<{ width: number; height: number }> {
  const bitmap = await createImageBitmap(file);
  const size = { width: bitmap.width, height: bitmap.height };
  bitmap.close();
  return size;
}

function galleryHost(app: AppName, path: string, token: Token, origin: string): GalleryHost {
  const base = `${origin}${path}`;
  const item = APP_ITEMS[app];
  const itemUrl = (id: string) => `${origin}${item.itemPath}${encodeURIComponent(id)}`;
  return {
    list: async (signal) => {
      const res = await call(token, base, {}, signal);
      if (res.status === 503) return null;
      const body = (await res.json()) as { images: WireImage[] };
      return body.images.map((i): GalleryImage => ({
        id: i.id,
        name: i.originalName ?? null,
        contentType: i.contentType,
        byteSize: i.byteSize,
        width: i.width,
        height: i.height,
        createdAt: i.createdAt,
      }));
    },
    usage: async (signal) => {
      const res = await call(token, `${base}/usage`, {}, signal);
      if (res.status === 503) return {};
      const body = (await res.json()) as { usage: Record<string, { id: string; name: string }[]> };
      const out: Record<string, GalleryUse[]> = {};
      for (const [id, uses] of Object.entries(body.usage)) {
        out[id] = uses.map((u) => ({ id: u.id, title: u.name, href: itemUrl(u.id) }));
      }
      return out;
    },
    imageBlob: async (image, signal) => {
      const res = await call(token, `${base}/${encodeURIComponent(image.id)}`, {}, signal).catch(
        () => null,
      );
      return res && res.ok ? res.blob() : null;
    },
    remove: async (image) => {
      await call(token, `${base}/${encodeURIComponent(image.id)}`, { method: 'DELETE' });
    },
    upload: async (file) => {
      if (!ACCEPTED.includes(file.type))
        throw new Error(uploadRefusal(new LibraryError(415, 'unsupported_type')));
      try {
        const { width, height } = await imageSize(file);
        const bytes = await file.arrayBuffer();
        const headers = new Headers({
          'Content-Type': file.type,
          'X-Image-Width': String(width),
          'X-Image-Height': String(height),
        });
        if (file.name) headers.set('X-Image-Original-Name', encodeURIComponent(file.name));
        await call(token, base, { method: 'POST', headers, body: bytes });
      } catch (e) {
        throw new Error(uploadRefusal(e));
      }
    },
    helpHref: `${origin}/help/explorer/image-gallery/`,
  };
}

// How many library versions' drawings a host keeps at once.
const PREVIEWS_KEPT = 20;

// A library as the app keeps it: its shapes carry their drawing, which a change sends back whole.
type WireLibrary = ShapeLibrary & { items: (LibraryShape & Record<string, unknown>)[] };

function shapeLibrariesHost(path: string, token: Token, origin: string): ShapeLibrariesHost {
  const base = `${origin}${path}`;
  const put = (library: ShapeLibrary, body: unknown) =>
    call(token, `${base}/${encodeURIComponent(library.id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  // Which library each listed shape is in, and each library version's drawings, so a library is drawn once per
  // version however many tiles show it. At most PREVIEWS_KEPT versions are kept; a failed read is forgotten.
  const libraryOf = new WeakMap<LibraryShape, WireLibrary>();
  const drawings = new Map<string, Promise<Record<string, string>>>();
  const drawn = (library: WireLibrary) => {
    const key = `${library.id}@${library.updatedAt ?? 0}`;
    let pending = drawings.get(key);
    if (!pending) {
      const url = `${base}/${encodeURIComponent(library.id)}/previews?v=${library.updatedAt ?? 0}`;
      pending = call(token, url)
        .then((res) => (res.ok ? res.json() : { previews: {} }))
        .then((body) => (body as { previews: Record<string, string> }).previews);
      pending.catch(() => drawings.delete(key));
      drawings.set(key, pending);
      if (drawings.size > PREVIEWS_KEPT) drawings.delete(drawings.keys().next().value!);
    }
    return pending;
  };
  const load = async (shape: LibraryShape): Promise<string | null> => {
    const library = libraryOf.get(shape);
    if (!library) return null;
    return (await drawn(library))[shape.id] ?? null;
  };
  return {
    list: async (signal) => {
      const res = await call(token, base, {}, signal);
      const body = (await res.json()) as { libraries: WireLibrary[] };
      for (const library of body.libraries)
        for (const shape of library.items) libraryOf.set(shape, library);
      return [...body.libraries].sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
    },
    renderShape: (shape) => createElement(ShapePreview, { shape, load }),
    rename: async (library, name) => {
      try {
        await put(library, { name });
        return { ok: true };
      } catch (e) {
        const taken = e instanceof LibraryError && e.code === 'shape_library_name_taken';
        return {
          ok: false,
          error: taken ? 'You already have a library with that name.' : 'That name didn’t save.',
        };
      }
    },
    remove: async (library) => {
      await call(token, `${base}/${encodeURIComponent(library.id)}`, { method: 'DELETE' });
    },
    removeShape: async (library, shape) => {
      await put(library, { items: library.items.filter((s) => s.id !== shape.id) });
    },
    nameMax: 120,
    helpHref: `${origin}/help/explorer/shape-libraries/`,
  };
}

export type AppLibraryHosts = { gallery?: GalleryHost; shapeLibraries?: ShapeLibrariesHost };

// One set per app, origin and token reader for the page's life, so the Explorer's reads key on stable objects.
const cache = new WeakMap<Token, Map<string, AppLibraryHosts>>();

/** The app's Library hosts: a page only where it keeps one. `origin` is the app's API (its site by default). */
export function appLibraryHosts(
  app: AppName,
  { token, origin = siteOfApp(app).url }: { token: Token; origin?: string },
): AppLibraryHosts {
  let byApp = cache.get(token);
  if (!byApp) cache.set(token, (byApp = new Map()));
  const key = `${app} ${origin}`;
  let hosts = byApp.get(key);
  if (!hosts) {
    const { imagesPath, shapeLibrariesPath } = APP_ITEMS[app];
    hosts = {
      ...(imagesPath ? { gallery: galleryHost(app, imagesPath, token, origin) } : {}),
      ...(shapeLibrariesPath
        ? { shapeLibraries: shapeLibrariesHost(shapeLibrariesPath, token, origin) }
        : {}),
    };
    byApp.set(key, hosts);
  }
  return hosts;
}
