// Parts the People and Ideas set shares (docs/specs/007-editor/pages-mode.md "Layouts"): a
// round photo, a card, a thin accent rule, an eyebrow line and a sticky note, each placed in the
// page's content box like the kit's own factories.
import { createSticky, type Element, type StickyElement } from '@liveplanner/document';
import type { Kit } from './page-layout-kit';

// A round photo placeholder.
export function avatar(k: Kit, x: number, y: number, d: number): Element {
  return { ...k.image(x, y, d, d), borderRadius: 'full', aspectLocked: true };
}

// A rounded card for a block of content to sit on.
export function card(k: Kit, x: number, y: number, w: number, h: number): Element {
  return k.shape('square', x, y, w, h, { label: '', borderRadius: 'lg' });
}

// A thin accent rule, across (w > h) or down; also the lines an org chart draws between people,
// which are LINE units thick (a stroke's width, so they read as a line rather than a bar).
export const LINE = 0.35;
export function rule(k: Kit, x: number, y: number, w: number, h: number): Element {
  return k.shape('square', x, y, w, h, { label: '', borderRadius: 'full' });
}

// A short bold line in capitals over a headline: what the page is.
export function eyebrow(k: Kit, x: number, y: number, w: number, label: string): Element {
  return k.text(x, y, w, k.u * 6, label, { textBold: true });
}

// A sticky note: it keeps its own paper colour whatever the theme, as stickies do.
export function sticky(
  k: Kit,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  extra: Partial<StickyElement> = {},
): StickyElement {
  const r = Math.round;
  return {
    ...createSticky(r(k.box.x + x), r(k.box.y + y)),
    width: r(w),
    height: r(h),
    label,
    textSize: 'lg',
    ...extra,
  };
}

// Clamp a size between a floor and a ceiling.
export const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
