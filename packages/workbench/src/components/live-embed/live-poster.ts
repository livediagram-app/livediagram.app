// A live embed's snapshot picture (liveworkspace/docs/specs/004-index/live-embeds.md "The snapshot picture"): the item's
// preview, asked of this page's own address with the reader's own token, drawn small on a canvas and kept as a webp
// (else jpeg) data URL under the cap. Null when there is no preview, it cannot be drawn, or it will not fit: the
// element then draws its plain card.
import {
  LIVE_POSTER_MAX_CHARS,
  LIVE_POSTER_MAX_EDGE,
  isLivePoster,
} from '@liveworkspace/element-model/live-item';
import { workbench } from '../../bindings';

// An item's preview on this page's own address (@liveworkspace/media previews.ts previewItemPath).
const previewPath = (itemId: string, appearance: 'light' | 'dark') =>
  `/api/previews/items/${encodeURIComponent(itemId)}?appearance=${appearance}`;

// Tried in turn until one fits the cap.
const ENCODINGS: readonly [type: string, quality: number][] = [
  ['image/webp', 0.82],
  ['image/webp', 0.6],
  ['image/jpeg', 0.7],
  ['image/jpeg', 0.5],
];

/** The size to draw at: the longer side at most `maxEdge`, never enlarged, at least one pixel. */
export function posterSize(
  width: number,
  height: number,
  maxEdge = LIVE_POSTER_MAX_EDGE,
): { width: number; height: number } {
  const scale = Math.min(1, maxEdge / Math.max(width, height, 1));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/** The first encoding of `canvas` that is a poster under the cap, else null. */
export function encodePoster(canvas: HTMLCanvasElement): string | null {
  for (const [type, quality] of ENCODINGS) {
    const url = canvas.toDataURL(type, quality);
    // A browser without webp hands back a png: kept only if it fits.
    if (url.length <= LIVE_POSTER_MAX_CHARS && isLivePoster(url)) return url;
  }
  return null;
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** The item's snapshot picture now, in `appearance`, or null. */
export async function captureLivePoster(
  itemId: string,
  appearance: 'light' | 'dark',
  origin: string = window.location.origin,
): Promise<string | null> {
  const bearer = await workbench.api.currentBearer();
  if (!bearer) return null;
  let blob: Blob;
  try {
    const res = await fetch(new URL(previewPath(itemId, appearance), origin), {
      headers: { Authorization: `Bearer ${bearer}` },
    });
    if (!res.ok) return null;
    blob = await res.blob();
  } catch {
    return null;
  }
  if (blob.size === 0) return null;
  const src = URL.createObjectURL(blob);
  try {
    const img = await loadImage(src);
    if (!img || img.naturalWidth === 0 || img.naturalHeight === 0) return null;
    const size = posterSize(img.naturalWidth, img.naturalHeight);
    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, size.width, size.height);
    return encodePoster(canvas);
  } finally {
    URL.revokeObjectURL(src);
  }
}
