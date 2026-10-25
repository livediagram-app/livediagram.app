// The Image Gallery's "Used in" map (liveworkspace/docs/media.md "Usage"), as every app's api answers
// `GET /api/images/usage`. The gallery lists the person's images from every app, so their uses are every app's
// too: an image placed only in another app's documents is used, not "Not used". The service says which
// documents, in which apps, place each image; the caller names each one (the index holds every app's items) and
// keeps only those its rule allows. Pure apart from `name`.

import { appOfSite, type AppName } from '@liveworkspace/sites';
import type { MediaUsage } from './wire';

/** One document that places an image, as the Gallery shows it: its id, its name and its app. */
export type ImageUse = { id: string; name: string; app: AppName };
export type ImageUsage = Record<string, ImageUse[]>;

// At most this many documents are named per answer, this many at once: each name is one index read.
export const GALLERY_USAGE_DOCUMENTS_MAX = 200;
export const GALLERY_USAGE_READS_IN_FLIGHT = 8;

/**
 * Each image's documents, in every app, named by `name` (null leaves a document out: gone, in the Trash, or not
 * the caller's to show), ordered by name then id, each document once. An image with none left has no entry. At most
 * `max` distinct documents are named, `inFlight` at a time; one past that is left out rather than failing the
 * Gallery.
 */
export async function galleryUsage(
  usage: MediaUsage,
  name: (app: AppName, document: string) => Promise<string | null>,
  { max = GALLERY_USAGE_DOCUMENTS_MAX, inFlight = GALLERY_USAGE_READS_IN_FLIGHT } = {},
): Promise<ImageUsage> {
  const key = (app: AppName, document: string) => `${app} ${document}`;
  const wanted = new Map<string, { app: AppName; document: string }>();
  for (const refs of Object.values(usage)) {
    for (const r of refs) {
      const app = appOfSite(r.app);
      if (!app) continue;
      const k = key(app, r.document);
      if (!wanted.has(k) && wanted.size < max) wanted.set(k, { app, document: r.document });
    }
  }
  const names = new Map<string, string>();
  const all = [...wanted];
  for (let i = 0; i < all.length; i += inFlight) {
    await Promise.all(
      all.slice(i, i + inFlight).map(async ([k, { app, document }]) => {
        const named = await name(app, document).catch(() => null);
        if (named !== null) names.set(k, named);
      }),
    );
  }
  const out: ImageUsage = {};
  for (const [imageId, refs] of Object.entries(usage)) {
    const seen = new Set<string>();
    const uses: ImageUse[] = [];
    for (const r of refs) {
      const app = appOfSite(r.app);
      if (!app) continue;
      const k = key(app, r.document);
      const named = names.get(k);
      if (named === undefined || seen.has(k)) continue;
      seen.add(k);
      uses.push({ id: r.document, name: named, app });
    }
    if (uses.length === 0) continue;
    out[imageId] = uses.sort(
      (a, b) =>
        a.name.localeCompare(b.name) || a.app.localeCompare(b.app) || a.id.localeCompare(b.id),
    );
  }
  return out;
}
