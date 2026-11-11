// The Image Gallery's "Used in" map (liveworkspace/docs/specs/006-media/media.md "Usage"), as every app's api answers
// `GET /api/images/usage`. The gallery lists the person's images from every app, so their uses are every app's
// too: an image placed only in another app's documents is used, not "Not used". The service says which
// documents, in which apps, place each image; the caller looks them all up in the index (it holds every app's
// items: `POST /api/index/items/lookup`) and keeps only those its rule allows. An image is never called unused
// without having been checked: one whose documents went unchecked is listed as such. Pure apart from `lookup`.

import { appOfSite, type AppName } from '@liveworkspace/sites';
import type { MediaUsage } from './wire';

/** One document that places an image, as the Gallery shows it: its id, its name and its app; `trashed` while it
 *  is in the owner's Trash (still a use: a restore would bring the picture back). */
export type ImageUse = { id: string; name: string; app: AppName; trashed?: true };
export type ImageUsage = Record<string, ImageUse[]>;

/** The usage answer: the map, and the images with references but none named because their documents could not
 *  be checked (past the bound, or in a lookup that failed). Absent from both, an image is unused. */
export type GalleryUsage = { usage: ImageUsage; unchecked: string[] };

/** `GET /api/images/usage` as an app answers it: `unknown` when the usage could not be read at all (the service
 *  or the index unreachable), so every image is unchecked. An older client reads only `usage`. */
export type GalleryUsageAnswer = GalleryUsage & { unknown?: true };

/** The answer when nothing could be checked. */
export const usageUnknown = (): GalleryUsageAnswer => ({ usage: {}, unchecked: [], unknown: true });

/** A document as the index answers a lookup (an index `Item` is one): what the Gallery's rules read. */
export type UsageDocument = {
  id: string;
  app: string;
  title: string;
  ownerId: string;
  trashedAt: number | null;
};

// Every distinct document is looked up, this many ids a request (the index's ITEM_LOOKUP_IDS_MAX), this many
// requests at a time, up to the safety bound: 5,000 documents are 25 requests in 7 rounds.
export const GALLERY_USAGE_DOCUMENTS_MAX = 5000;
export const GALLERY_USAGE_LOOKUP_IDS = 200;
export const GALLERY_USAGE_LOOKUPS_AT_ONCE = 4;

/** Runs `work` over `batches`, at most `limit` at a time. */
async function inRounds<T>(batches: T[], limit: number, work: (batch: T) => Promise<void>) {
  let next = 0;
  const lane = async () => {
    while (next < batches.length) await work(batches[next++]!);
  };
  await Promise.all(Array.from({ length: Math.min(limit, batches.length) }, lane));
}

/**
 * Each image's documents, in every app, looked up by `lookup` (the documents the index answers; those it leaves
 * out are gone or not the caller's to open) and kept by `keep`, named by their titles, ordered by name then id,
 * each document once; a trashed one is marked. A document is named only when the index's item is in the app the
 * reference names. An image with none left has no entry, and is listed in `unchecked` when any of its documents
 * went unlooked-up (past `max` distinct documents) or was in a lookup that failed.
 */
export async function galleryUsage(
  usage: MediaUsage,
  lookup: (ids: string[]) => Promise<readonly UsageDocument[]>,
  {
    max = GALLERY_USAGE_DOCUMENTS_MAX,
    keep = () => true,
  }: { max?: number; keep?: (document: UsageDocument) => boolean } = {},
): Promise<GalleryUsage> {
  const key = (app: string, document: string) => `${app} ${document}`;
  const wanted = new Set<string>();
  const ids = new Set<string>();
  for (const refs of Object.values(usage)) {
    for (const r of refs) {
      const app = appOfSite(r.app);
      if (!app || wanted.size >= max) continue;
      const k = key(app, r.document);
      if (wanted.has(k)) continue;
      wanted.add(k);
      ids.add(r.document);
    }
  }
  const found = new Map<string, { name: string; trashed: boolean }>();
  const failed = new Set<string>();
  const all = [...ids];
  const batches: string[][] = [];
  for (let i = 0; i < all.length; i += GALLERY_USAGE_LOOKUP_IDS) {
    batches.push(all.slice(i, i + GALLERY_USAGE_LOOKUP_IDS));
  }
  await inRounds(batches, GALLERY_USAGE_LOOKUPS_AT_ONCE, async (batch) => {
    let documents: readonly UsageDocument[];
    try {
      documents = await lookup(batch);
    } catch {
      for (const id of batch) failed.add(id);
      return;
    }
    for (const document of documents) {
      const k = key(document.app, document.id);
      if (wanted.has(k) && keep(document)) {
        found.set(k, { name: document.title, trashed: document.trashedAt !== null });
      }
    }
  });
  const out: ImageUsage = {};
  const unchecked: string[] = [];
  for (const [imageId, refs] of Object.entries(usage)) {
    const seen = new Set<string>();
    const uses: ImageUse[] = [];
    let unsure = false;
    for (const r of refs) {
      const app = appOfSite(r.app);
      if (!app) continue;
      const k = key(app, r.document);
      if (!wanted.has(k) || failed.has(r.document)) unsure = true;
      const named = found.get(k);
      if (named === undefined || seen.has(k)) continue;
      seen.add(k);
      uses.push({
        id: r.document,
        name: named.name,
        app,
        ...(named.trashed ? { trashed: true as const } : {}),
      });
    }
    if (uses.length === 0) {
      if (unsure) unchecked.push(imageId);
      continue;
    }
    out[imageId] = uses.sort(
      (a, b) =>
        a.name.localeCompare(b.name) || a.app.localeCompare(b.app) || a.id.localeCompare(b.id),
    );
  }
  return { usage: out, unchecked };
}
