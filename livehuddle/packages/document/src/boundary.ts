// The boundary (docs/specs/009-elements/boundary.md): a container that means something, a cloud region, a VPC, a
// system in a C4 diagram. Pure: its styles, the layout of its title, its tint and its writes. Containment is the
// shared rule (containment.ts), not a copy.

import type { Element, ShapeElement } from './index';
import type { LayoutRect } from './web-components';

export type BoundaryStyle = 'tab' | 'inset' | 'c4';
export const BOUNDARY_STYLES: readonly BoundaryStyle[] = ['tab', 'inset', 'c4'];

// The wash a boundary with no fill of its own takes: 6% of its accent, so a boundary nested in another
// reads deeper as the two washes stack.
export const BOUNDARY_TINT = 0.06;
const BOUNDARY_TAB_H = 26;

export function isBoundaryStyle(v: unknown): v is BoundaryStyle {
  return v === 'tab' || v === 'inset' || v === 'c4';
}

export function boundaryStyleOf(el: ShapeElement): BoundaryStyle {
  return isBoundaryStyle(el.boundaryStyle) ? el.boundaryStyle : 'tab';
}

type BoundaryLayout = {
  tab: LayoutRect | null;
  icon: LayoutRect | null;
  title: LayoutRect;
  meta: LayoutRect | null;
  titlePx: number;
  metaPx: number;
};

const TITLE_PX = 14;
const META_PX = 11;
const ICON = 16;

/** Where a boundary's title, icon and meta line sit, element-relative, for its style. */
export function boundaryLayout(
  w: number,
  h: number,
  o: { style: BoundaryStyle; icon: boolean; titleChars: number; meta: boolean },
): BoundaryLayout {
  // A bold title's width from its characters (no DOM headless), generous so it never wraps in its tab.
  const titleW = Math.ceil(o.titleChars * TITLE_PX * 0.66) + 6;
  if (o.style === 'c4') {
    const twoLines = o.meta && h >= 64;
    return {
      tab: null,
      icon: null,
      title: { x: 12, y: h - (twoLines ? 46 : 32), width: Math.max(0, w - 24), height: 22 },
      meta: twoLines ? { x: 12, y: h - 26, width: Math.max(0, w - 24), height: 18 } : null,
      titlePx: TITLE_PX + 1,
      metaPx: META_PX,
    };
  }
  if (o.style === 'inset') {
    const iconW = o.icon ? ICON + 6 : 0;
    const titleRoom = Math.max(0, Math.min(titleW + 4, w - 24 - iconW));
    return {
      tab: null,
      icon: o.icon ? { x: 12, y: 13, width: ICON, height: ICON } : null,
      title: { x: 12 + iconW, y: 10, width: titleRoom, height: 22 },
      meta: o.meta
        ? {
            x: 12 + iconW + titleRoom + 8,
            y: 10,
            width: Math.max(0, w - 12 - (12 + iconW + titleRoom + 8)),
            height: 22,
          }
        : null,
      titlePx: TITLE_PX,
      metaPx: META_PX,
    };
  }
  // Tab: straddling the top edge.
  const iconW = o.icon ? ICON + 6 : 0;
  const tabW = Math.max(40, Math.min(w - 28, 10 + iconW + titleW + 10));
  const tab = { x: 14, y: -BOUNDARY_TAB_H / 2, width: tabW, height: BOUNDARY_TAB_H };
  return {
    tab,
    icon: o.icon
      ? { x: tab.x + 10, y: tab.y + (BOUNDARY_TAB_H - ICON) / 2, width: ICON, height: ICON }
      : null,
    title: {
      x: tab.x + 10 + iconW,
      y: tab.y,
      width: Math.max(0, tabW - 20 - iconW),
      height: BOUNDARY_TAB_H,
    },
    meta: o.meta
      ? { x: 14, y: BOUNDARY_TAB_H / 2 + 6, width: Math.max(0, w - 28), height: 18 }
      : null,
    titlePx: TITLE_PX,
    metaPx: META_PX,
  };
}

/** Set (or clear back to Tab, with `null`) a boundary's style. C4's long dash replaces the default dash with it. */
/** A boundary's meta line on or off (docs/specs/009-elements/boundary.md "The menu"): on gives it starting words to
 *  type over, off clears it. */
export const BOUNDARY_META_DEFAULT = 'Meta line';
export function withBoundaryMeta<T extends Element>(el: T, on: boolean): T {
  if (el.type !== 'shape' || el.shape !== 'boundary') return el;
  const next = { ...el } as T & { pageSubtitle?: string };
  if (on) next.pageSubtitle = next.pageSubtitle || BOUNDARY_META_DEFAULT;
  else delete next.pageSubtitle;
  return next;
}

export function withBoundaryStyle<T extends Element>(el: T, style: BoundaryStyle | null): T {
  if (el.type !== 'shape' || el.shape !== 'boundary') return el;
  const next = { ...el } as T & { boundaryStyle?: BoundaryStyle; strokeStyle?: string };
  if (style && style !== 'tab') next.boundaryStyle = style;
  else delete next.boundaryStyle;
  if (style === 'c4' && (next.strokeStyle === undefined || next.strokeStyle === 'dashed'))
    next.strokeStyle = 'long-dash';
  else if (style !== 'c4' && next.strokeStyle === 'long-dash') next.strokeStyle = 'dashed';
  return next;
}
