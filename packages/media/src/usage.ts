// The Image Gallery's "Used in" map (liveworkspace/docs/specs/006-media/media.md "Usage"), as every app's api answers
// `GET /api/images/usage`. The gallery lists the person's images from every app, so their uses are every app's
// too: an image placed only in another app's documents is used, not "Not used". The service says which
// documents, in which apps, place each image; the caller looks them all up in the index at once (it holds every
// app's items: `POST /api/index/items/lookup`) and keeps only those its rule allows. Pure apart from `lookup`.

import { appOfSite, type AppName } from '@liveworkspace/sites';
import type { MediaUsage } from './wire';

/** One document that places an image, as the Gallery shows it: its id, its name and its app. */
export type ImageUse = { id: string; name: string; app: AppName };
export type ImageUsage = Record<string, ImageUse[]>;

/** A document as the index answers a lookup (an index `Item` is one): what the Gallery's rules read. */
export type UsageDocument = {
  id: string;
  app: string;
  title: string;
  ownerId: string;
  trashedAt: number | null;
};

// At most this many documents are named per answer, looked up this many ids a request (the index's
// ITEM_LOOKUP_IDS_MAX), so 200 documents are one request.
export const GALLERY_USAGE_DOCUMENTS_MAX = 200;
export const GALLERY_USAGE_LOOKUP_IDS = 200;

/**
 * Each image's documents, in every app, looked up by `lookup` (the documents the index answers, those it leaves out
 * gone or not the caller's to open) and kept by `keep`, named by their titles, ordered by name then id, each
 * document once. A document is named only when the index's item is in the app the reference names. An image with
 * none left has no entry. At most `max` distinct documents are looked up; one past that, or a lookup that fails, is
 * left out rather than failing the Gallery.
 */
export async function galleryUsage(
  usage: MediaUsage,
  lookup: (ids: string[]) => Promise<readonly UsageDocument[]>,
  {
    max = GALLERY_USAGE_DOCUMENTS_MAX,
    keep = () => true,
  }: { max?: number; keep?: (document: UsageDocument) => boolean } = {},
): Promise<ImageUsage> {
  const key = (app: string, document: string) => `${app} ${document}`;
  const wanted = new Set<string>();
  const ids = new Set<string>();
  for (const refs of Object.values(usage)) {
    for (const r of refs) {
      const app = appOfSite(r.app);
      if (!app) continue;
      const k = key(app, r.document);
      if (wanted.has(k) || wanted.size >= max) continue;
      wanted.add(k);
      ids.add(r.document);
    }
  }
  const names = new Map<string, string>();
  const all = [...ids];
  const batches: string[][] = [];
  for (let i = 0; i < all.length; i += GALLERY_USAGE_LOOKUP_IDS) {
    batches.push(all.slice(i, i + GALLERY_USAGE_LOOKUP_IDS));
  }
  await Promise.all(
    batches.map(async (batch) => {
      const found = await lookup(batch).catch(() => []);
      for (const document of found) {
        const k = key(document.app, document.id);
        if (wanted.has(k) && keep(document)) names.set(k, document.title);
      }
    }),
  );
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
