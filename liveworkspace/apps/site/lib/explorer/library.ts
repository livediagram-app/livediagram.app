'use client';

// The Library on liveworkspace.app's Explorer (@liveworkspace/explorer's gallery and shape-libraries hosts): the
// person's images and shape libraries, read from the app they came from (the sites registry's `imagesPath` and
// `shapeLibrariesPath`) by the workspace token every app's API accepts. The images live in the media service and the
// libraries in the person's Durable Object behind the app; nothing is stored here. An app without one has no such
// page. Drawing a shape takes the app's editor, so shapes show as plain tiles here.

import type {
  GalleryHost,
  GalleryImage,
  GalleryUse,
  LibraryShape,
  ShapeLibrariesHost,
  ShapeLibrary,
} from '@liveworkspace/explorer';
import { APP_ITEMS, siteOfApp, type AppName } from '@liveworkspace/sites';
import { workspaceToken } from './token';

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

async function call(url: string, init: RequestInit = {}, signal?: AbortSignal): Promise<Response> {
  const token = await workspaceToken();
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
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

function galleryHost(app: AppName, path: string): GalleryHost {
  const base = `${siteOfApp(app).url}${path}`;
  const item = APP_ITEMS[app];
  const itemUrl = (id: string) => `${siteOfApp(app).url}${item.itemPath}${encodeURIComponent(id)}`;
  return {
    list: async (signal) => {
      const res = await call(base, {}, signal);
      if (res.status === 503) return null;
      const body = (await res.json()) as { images: WireImage[] };
      return body.images.map(
        (i): GalleryImage => ({
          id: i.id,
          name: i.originalName ?? null,
          contentType: i.contentType,
          byteSize: i.byteSize,
          width: i.width,
          height: i.height,
          createdAt: i.createdAt,
        }),
      );
    },
    usage: async (signal) => {
      const res = await call(`${base}/usage`, {}, signal);
      if (res.status === 503) return {};
      const body = (await res.json()) as { usage: Record<string, { id: string; name: string }[]> };
      const out: Record<string, GalleryUse[]> = {};
      for (const [id, uses] of Object.entries(body.usage)) {
        out[id] = uses.map((u) => ({ id: u.id, title: u.name, href: itemUrl(u.id) }));
      }
      return out;
    },
    imageBlob: async (image, signal) => {
      const res = await call(`${base}/${encodeURIComponent(image.id)}`, {}, signal).catch(
        () => null,
      );
      return res && res.ok ? res.blob() : null;
    },
    remove: async (image) => {
      await call(`${base}/${encodeURIComponent(image.id)}`, { method: 'DELETE' });
    },
    upload: async (file) => {
      if (!ACCEPTED.includes(file.type)) throw new Error(uploadRefusal(new LibraryError(415, 'unsupported_type')));
      try {
        const { width, height } = await imageSize(file);
        const bytes = await file.arrayBuffer();
        const headers = new Headers({
          'Content-Type': file.type,
          'X-Image-Width': String(width),
          'X-Image-Height': String(height),
        });
        if (file.name) headers.set('X-Image-Original-Name', encodeURIComponent(file.name));
        await call(base, { method: 'POST', headers, body: bytes });
      } catch (e) {
        throw new Error(uploadRefusal(e));
      }
    },
    helpHref: `${siteOfApp(app).url}/help/explorer/image-gallery/`,
  };
}

// A library as the app keeps it: its shapes carry their drawing, which a change sends back whole.
type WireLibrary = ShapeLibrary & { items: (LibraryShape & Record<string, unknown>)[] };

function shapeLibrariesHost(app: AppName, path: string): ShapeLibrariesHost {
  const base = `${siteOfApp(app).url}${path}`;
  const put = (library: ShapeLibrary, body: unknown) =>
    call(`${base}/${encodeURIComponent(library.id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  return {
    list: async (signal) => {
      const res = await call(base, {}, signal);
      const body = (await res.json()) as { libraries: WireLibrary[] };
      return [...body.libraries].sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
    },
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
      await call(`${base}/${encodeURIComponent(library.id)}`, { method: 'DELETE' });
    },
    removeShape: async (library, shape) => {
      await put(library, { items: library.items.filter((s) => s.id !== shape.id) });
    },
    nameMax: 120,
    helpHref: `${siteOfApp(app).url}/help/explorer/shape-libraries/`,
  };
}

// One host per app for the page's life, so the Explorer's reads key on a stable object.
const galleries = new Map<AppName, GalleryHost | null>();
const shapes = new Map<AppName, ShapeLibrariesHost | null>();

/** The app's Library hosts, or undefined for a page it keeps none of. */
export function libraryHosts(app: AppName): {
  gallery?: GalleryHost;
  shapeLibraries?: ShapeLibrariesHost;
} {
  if (!galleries.has(app)) {
    const path = APP_ITEMS[app].imagesPath;
    galleries.set(app, path ? galleryHost(app, path) : null);
  }
  if (!shapes.has(app)) {
    const path = APP_ITEMS[app].shapeLibrariesPath;
    shapes.set(app, path ? shapeLibrariesHost(app, path) : null);
  }
  return {
    ...(galleries.get(app) ? { gallery: galleries.get(app)! } : {}),
    ...(shapes.get(app) ? { shapeLibraries: shapes.get(app)! } : {}),
  };
}
