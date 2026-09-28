// draw.io's embedded images through the shared import image pipeline
// (docs/specs/020-import-export/drawio-import.md "Images"). A multi-page file's
// images go through ONE pass (one progress count, one session, identical
// pictures stored once across pages), then each page gets its own elements back.

import type { Element } from '@livediagram/diagram';
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
