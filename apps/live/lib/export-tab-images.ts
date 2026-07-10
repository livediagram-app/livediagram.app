// Pre-loads the bitmaps an image/avatar element references so the visual tab
// exporters (PNG / SVG / PDF) can embed them instead of drawing the dashed
// placeholder. The bytes live in R2 behind an authenticated endpoint, so a
// native `<img src>` (no auth headers) can't reach them; we fetch each one as
// a base64 data URL — which both inlines into a downloadable SVG and decodes
// onto the export canvas without tainting it — then decode it to an
// HTMLImageElement for the canvas path. Browser-only (uses Image / FileReader);
// never reached in the no-DOM test runs.
import type { Tab } from '@livediagram/diagram';
import { apiFetchImageDataUrl } from './api/images';

type ExportImageEntry = {
  // base64 data URL — embedded into the SVG export's <image href>.
  href: string;
  // Decoded element for the PNG/PDF canvas's ctx.drawImage.
  image: HTMLImageElement;
};

// imageId → loaded bytes. An imageId absent from the map (fetch failed, or no
// image picked) makes that element fall back to the placeholder.
export type ExportImageMap = Map<string, ExportImageEntry>;

// Identify + de-duplicate the image ids on a tab, fetch + decode each once,
// and return them keyed by id. Failures are swallowed per-image so one broken
// bitmap never aborts the export — that element just renders its placeholder.
export async function loadTabImages(
  tab: Tab,
  ctx: { ownerId: string; diagramId: string; shareCode: string | null },
): Promise<ExportImageMap> {
  const ids = Array.from(
    new Set(tab.elements.flatMap((el) => (el.type === 'image' && el.imageId ? [el.imageId] : []))),
  );
  const map: ExportImageMap = new Map();
  await Promise.all(
    ids.map(async (id) => {
      try {
        // Offline Mode (spec/76): an embedded image already IS a data URL.
        const href = id.startsWith('data:')
          ? id
          : await apiFetchImageDataUrl(ctx.ownerId, id, {
              diagramId: ctx.diagramId,
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

function decodeImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image decode failed'));
    img.src = src;
  });
}
