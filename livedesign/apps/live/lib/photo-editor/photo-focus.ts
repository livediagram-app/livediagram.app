// Which photo page is in focus (docs/specs/031-photo/photo-pages.md "Working on a photo page"): the
// one pressed, while it is still in view; else the photo page that takes the most of the view. Only
// the page in focus holds its layers' pixels; every other shows its preview.
import type { LaidOutPage } from '@livedesign/design';

type Rect = { x: number; y: number; width: number; height: number };

// A photo page showing less of itself than this share of the view is not taken into focus by the view
// alone (a sliver at an edge).
export const PHOTO_FOCUS_MIN_SHARE = 0.15;

function overlap(a: Rect, b: Rect): number {
  const w = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

export function photoFocusOf(
  pages: readonly LaidOutPage[],
  view: Rect | null,
  pressed: string | null,
): string | null {
  const photos = pages.filter((p) => p.kind === 'photo');
  if (!photos.length || !view) return null;
  const pressedPage = pressed ? photos.find((p) => p.id === pressed) : undefined;
  if (pressedPage && overlap(pressedPage.rect, view) > 0) return pressedPage.id;
  const area = view.width * view.height;
  let best: string | null = null;
  let bestArea = 0;
  for (const p of photos) {
    const a = overlap(p.rect, view);
    // A page wholly in view counts whatever its size; otherwise the share it takes of the view.
    const whole = a >= p.rect.width * p.rect.height - 1e-6;
    if (a > bestArea && (whole || a >= area * PHOTO_FOCUS_MIN_SHARE)) {
      best = p.id;
      bestArea = a;
    }
  }
  return best;
}
