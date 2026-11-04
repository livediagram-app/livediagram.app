// A tab tile's preview (docs/specs/026-plan/plan-overview.md "Tabs"): which tab the export draws, and how its SVG
// fits the tile. Pure.
import { EXPORT_PADDING, tabKindOf, type Tab } from '@liveplanner/project';

// The window a preview shows (blueprint DEFAULTS D82): the Dashboard export's width, at 16:10.
export const PREVIEW_W = 1440;
export const PREVIEW_H = 900;
// The window a Board or Sheet tab's own view is laid out in (LivePlanPreview): a small screen, so a tile about 220 px
// wide still reads its columns and cards rather than specks.
export const LIVE_PREVIEW_W = 960;
export const LIVE_PREVIEW_H = 600;

const FILLS: Record<string, string> = { board: 'plan-board', sheet: 'plan-sheet' };

// The tab to draw: a Board or Sheet tab's element sized to the window, as a screen that size shows it filling the tab
// (plan-tabs.md "Board tab"), so its export is exactly the window. Any other tab as it is.
export function previewTabOf(tab: Tab): Tab {
  const shape = tab.kind ? FILLS[tab.kind] : undefined;
  if (!shape) return tab;
  let changed = false;
  const elements = tab.elements.map((el) => {
    if (changed || el.type !== 'shape' || el.shape !== shape) return el;
    changed = true;
    return {
      ...el,
      x: 0,
      y: 0,
      width: PREVIEW_W - EXPORT_PADDING * 2,
      height: PREVIEW_H - EXPORT_PADDING * 2,
    };
  });
  return changed ? { ...tab, elements } : tab;
}

export type PreviewFit = { scale: number; x: number; y: number };

// How the SVG (its own size `w` × `h`) sits in a tile `tileW` × `tileH`: a Plan tab's window (at most 1440 × 900 of
// it, from the top left) scaled to fill the tile, centred along a side the drawing is narrower than; any other tab's
// drawing fitted whole and centred.
export function previewFit(
  svg: { w: number; h: number },
  tile: { w: number; h: number },
  whole: boolean,
): PreviewFit {
  const viewW = whole ? svg.w : Math.min(svg.w, PREVIEW_W);
  const viewH = whole ? svg.h : Math.min(svg.h, PREVIEW_H);
  if (viewW <= 0 || viewH <= 0 || tile.w <= 0 || tile.h <= 0) return { scale: 0, x: 0, y: 0 };
  const scale = Math.min(tile.w / viewW, tile.h / viewH);
  return {
    scale,
    x: Math.max(0, (tile.w - viewW * scale) / 2),
    y: Math.max(0, (tile.h - viewH * scale) / 2),
  };
}

// A Board, Sheet, Dashboard or Form tab shows its window; anything else (a drawing) is fitted whole.
export const isWindowed = (tab: Tab): boolean => {
  const kind = tabKindOf(tab);
  return kind === 'board' || kind === 'sheet' || kind === 'dashboard' || kind === 'form';
};
