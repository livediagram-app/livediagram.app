// Pre-loads the bitmaps an image/avatar element references so the visual tab
// exporters (PNG / SVG / PDF) can embed them instead of drawing the dashed
// placeholder. The bytes live in R2 behind an authenticated endpoint, so a
// native `<img src>` (no auth headers) can't reach them; we fetch each one as
// a base64 data URL — which both inlines into a downloadable SVG and decodes
// onto the export canvas without tainting it — then decode it to an
// HTMLImageElement for the canvas path. Browser-only (uses Image / FileReader);
// never reached in the no-DOM test runs.
import { pageImageIds, photosOf, type Tab } from '@livedesign/document';
import { apiFetchImageDataUrl } from './api/images';
import { fetchBlob } from './photo-editor/blob-client';

/** The key a photo page's picture is kept under in the map (docs/specs/031-photo/photo-pages.md
 *  "Exports and other views": a page's export draws its photo's preview). */
export const photoImageKey = (pageId: string): string => `photo:${pageId}`;

type ExportImageEntry = {
  // base64 data URL — embedded into the SVG export's <image href>.
  href: string;
  // Decoded element for the PNG/PDF canvas's ctx.drawImage; absent for an SVG-only render (a
  // layout tile's sample picture), which the canvas path then draws as the placeholder.
  image?: HTMLImageElement;
};

// imageId → loaded bytes. An imageId absent from the map (fetch failed, or no
// image picked) makes that element fall back to the placeholder.
export type ExportImageMap = Map<string, ExportImageEntry>;

// The raster types an upload can hold (the api sniffs to these four).
const SAFE_INLINE_IMAGE = /^data:image\/(png|jpeg|gif|webp);base64,[A-Za-z0-9+/=]+$/;

/** The image ids a tab draws, once each: its image elements' and its pages' pictures
 *  (docs/specs/007-editor/pages-mode.md "Image backgrounds"). */
export function tabImageIds(tab: Pick<Tab, 'elements' | 'pages'>): string[] {
  return Array.from(
    new Set([
      ...tab.elements.flatMap((el) => (el.type === 'image' && el.imageId ? [el.imageId] : [])),
      ...pageImageIds(tab.pages),
    ]),
  );
}

/** Those ids sorted and joined: the key a tab's bitmaps are fetched on, so an edit that moves a
 *  shape, or one on another tab, does not fetch every photo again. */
export function tabImageKey(tab: Pick<Tab, 'elements' | 'pages'>): string {
  return tabImageIds(tab).sort().join(',');
}

// Identify + de-duplicate the image ids on a tab (tabImageIds), fetch + decode each once,
// and return them keyed by id. Failures are swallowed per-image so one broken
// bitmap never aborts the export — that element just renders its placeholder.
export async function loadTabImages(
  tab: Tab,
  ctx: { ownerId: string; documentId: string; shareCode: string | null },
): Promise<ExportImageMap> {
  const ids = tabImageIds(tab);
  const map: ExportImageMap = new Map();
  // Each photo page's preview (no larger than 2048 px), as its page's picture.
  const photos = Object.entries(photosOf(tab)).filter(([, p]) => p.preview);
  await Promise.all(
    photos.map(async ([pageId, p]) => {
      try {
        const blob = await fetchBlob(ctx, tab.id, p.preview!);
        if (!blob) return;
        const href = await blobDataUrl(blob);
        if (!SAFE_INLINE_IMAGE.test(href)) return;
        map.set(photoImageKey(pageId), { href, image: await decodeImage(href) });
      } catch {
        // Skip: the page draws its checkerboard.
      }
    }),
  );
  await Promise.all(
    ids.map(async (id) => {
      try {
        // Offline Mode (docs/specs/006-document/offline-mode.md): an embedded image already IS a data URL.
        // Only a base64 raster data URL is taken as inline bytes: the id is
        // document data another editor chose, and it becomes markup below.
        if (id.startsWith('data:') && !SAFE_INLINE_IMAGE.test(id)) return;
        const href = id.startsWith('data:')
          ? id
          : await apiFetchImageDataUrl(ctx.ownerId, id, {
              documentId: ctx.documentId,
              shareCode: ctx.shareCode,
            });
        if (!href) return;
        map.set(id, { href, image: await decodeImage(href) });
      } catch {
        // Skip — the element falls back to its placeholder.
      }
    }),
  );
  return map;
}

function blobDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(typeof r.result === 'string' ? r.result : '');
    r.onerror = () => reject(new Error('read failed'));
    r.readAsDataURL(blob);
  });
}

function decodeImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image decode failed'));
    img.src = src;
  });
}
