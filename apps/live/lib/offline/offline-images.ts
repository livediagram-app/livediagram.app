// Image re-homing for the Offline Mode conversions (spec/76 + spec/19).
//
// A cloud diagram's images live in R2 and elements carry an opaque
// `imageId`; an offline diagram must be self-contained, so its images are
// embedded straight into the element as a base64 `data:` URI (the renderer
// and exporters treat a data-URI imageId as the bytes themselves). The two
// conversions therefore re-home images in opposite directions:
//
//   Take Offline: download each referenced R2 image and embed it, BEFORE the
//   server copy is deleted. Without this the diagram row's deletion makes the
//   images "unused", and the api's 30-day retention reaper would delete the
//   bytes out from under the offline diagram.
//
//   Sync Diagram: upload each embedded image to the gallery (dedup by
//   SHA-256 server-side) and swap the data URI back to the returned R2 id,
//   so the cloud copy gets real gallery images instead of bloated tab JSON.
//
// Both directions are best-effort per image: a failed transfer keeps the
// element's current reference rather than aborting the whole conversion (a
// kept R2 id still renders while online; a kept data URI renders anywhere).

import type { Tab } from '@livediagram/diagram';
import { apiFetchImageDataUrl } from '../api/images';
import { uploadImageFile } from '../upload-image';

export function isDataImageId(imageId: string | null | undefined): boolean {
  return typeof imageId === 'string' && imageId.startsWith('data:');
}

// Distinct imageIds on the given tabs that match the predicate.
function collectImageIds(tabs: Tab[], match: (id: string) => boolean): string[] {
  const ids = new Set<string>();
  for (const tab of tabs) {
    for (const el of tab.elements) {
      if (el.type === 'image' && el.imageId && match(el.imageId)) ids.add(el.imageId);
    }
  }
  return [...ids];
}

// Swap every matching imageId through the map (ids absent from the map are
// left untouched). Pure; exported for tests.
export function rewriteImageIds(tabs: Tab[], mapping: Map<string, string>): Tab[] {
  if (mapping.size === 0) return tabs;
  return tabs.map((tab) => ({
    ...tab,
    elements: tab.elements.map((el) => {
      if (el.type !== 'image' || !el.imageId) return el;
      const next = mapping.get(el.imageId);
      return next && next !== el.imageId ? { ...el, imageId: next } : el;
    }),
  }));
}

// Decode a base64 data URL into a File for the shared upload flow. Pure
// (given browser/Node 18+ globals); exported for tests.
export function dataUrlToFile(dataUrl: string, name = 'offline-image'): File | null {
  const match = /^data:([^;,]+);base64,(.*)$/s.exec(dataUrl);
  if (!match) return null;
  const [, mime, payload] = match;
  try {
    const binary = atob(payload!);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new File([bytes], name, { type: mime! });
  } catch {
    return null;
  }
}

// Take Offline: fetch each referenced R2 image (authenticated, before the
// server copy goes away) and embed it as a data URI.
export async function embedTabImages(
  tabs: Tab[],
  ctx: { ownerId: string; diagramId: string; shareCode: string | null },
): Promise<Tab[]> {
  const ids = collectImageIds(tabs, (id) => !isDataImageId(id));
  if (ids.length === 0) return tabs;
  const mapping = new Map<string, string>();
  await Promise.all(
    ids.map(async (id) => {
      const href = await apiFetchImageDataUrl(ctx.ownerId, id, {
        diagramId: ctx.diagramId,
        shareCode: ctx.shareCode,
      }).catch(() => null);
      if (href) mapping.set(id, href);
    }),
  );
  return rewriteImageIds(tabs, mapping);
}

// Sync Diagram: upload each embedded image to the gallery and swap the data
// URI for the stored image's id. The server dedupes by SHA-256, so syncing
// the same picture twice lands on one gallery entry.
export async function uploadEmbeddedImages(ownerId: string, tabs: Tab[]): Promise<Tab[]> {
  const ids = collectImageIds(tabs, isDataImageId);
  if (ids.length === 0) return tabs;
  const mapping = new Map<string, string>();
  await Promise.all(
    ids.map(async (dataUrl) => {
      const file = dataUrlToFile(dataUrl);
      if (!file) return;
      try {
        const { image } = await uploadImageFile(ownerId, file);
        mapping.set(dataUrl, image.id);
      } catch {
        // Keep the data URI: it still renders on the cloud copy, and the
        // per-tab byte cap will surface a hard failure to the caller.
      }
    }),
  );
  return rewriteImageIds(tabs, mapping);
}
