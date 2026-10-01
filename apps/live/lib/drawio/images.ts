// draw.io's embedded images through the shared import image pipeline
// (docs/specs/020-import-export/drawio-import.md "Images"). A multi-page file's
// images go through ONE pass (one progress count, one session, identical
// pictures stored once across pages), then each page gets its own elements back.

import type { Element } from '@livediagram/document';
import type { ImportImageReport, ImportImageRequest } from '@/lib/import-images';

/** `attachImportImages` with its session and progress listener already bound. */
export type AttachImages = (
  elements: Element[],
  requests: ImportImageRequest[],
) => Promise<{ elements: Element[]; report: ImportImageReport }>;

export async function attachDrawioImages<P extends { elements: Element[] }>(
  pages: P[],
  requests: ImportImageRequest[],
  attach: AttachImages,
): Promise<{ pages: P[]; images: ImportImageReport | undefined }> {
  if (requests.length === 0) return { pages, images: undefined };
  const { elements, report } = await attach(
    pages.flatMap((p) => p.elements),
    requests,
  );
  let at = 0;
  const patched = pages.map((page) => {
    const own = elements.slice(at, at + page.elements.length);
    at += page.elements.length;
    return { ...page, elements: own };
  });
  return { pages: patched, images: report };
}

// draw.io writes an embedded image as `data:<type>,<base64>` (the `;` of
// `;base64` would end the style pair), so restore the standard form when the
// payload is base64; a percent-encoded or raw payload stays as it is.
export function normaliseDataUrl(url: string): string {
  const m = /^data:([^,;]+),(.*)$/s.exec(url);
  return m && /^[A-Za-z0-9+/]+=*$/.test(m[2]!) ? `data:${m[1]};base64,${m[2]}` : url;
}

/**
 * Asks the shared import image pipeline to store an embedded picture for one image element. The
 * same picture twice shares one key, so it is stored once.
 */
export function requestDataUrlImage(
  ctx: { images: ImportImageRequest[]; imageKeys: Map<string, string> },
  elementId: string,
  source: string,
  hint: { width: number; height: number },
): void {
  const dataUrl = normaliseDataUrl(source);
  let key = ctx.imageKeys.get(dataUrl);
  if (!key) {
    key = `drawio-image-${ctx.imageKeys.size + 1}`;
    ctx.imageKeys.set(dataUrl, key);
  }
  ctx.images.push({ elementId, key, source: { kind: 'data-url', dataUrl }, hint });
}
