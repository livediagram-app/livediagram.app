// The tab window (docs/specs/009-elements/tab-window.md, retired 2026-11-10): an element that showed another tab of
// the same item. Nothing makes one any more; a stored one still validates, loads and draws, as a still frame named for
// the tab it showed. Pure: the kinds no surface makes, the frame's sizes and colours, and its picture in an export.
// livedesign and liveplanner share it.
import type { CanvasSurface } from './colour-math';
import { r2, xmlEscape } from './svg-render-primitives';
import { SKETCH_FACE_FILTER } from './svg-render-sketch';

/** Shape kinds no surface makes any more (no palette tile, no agent `add`), kept so stored ones load. */
export const RETIRED_SHAPE_KINDS: ReadonlySet<string> = new Set(['tab-window']);

/** A window's size as it landed (16:9). */
export const TAB_WINDOW_SIZE = { width: 640, height: 360 } as const;
/** Its rounded corners. */
export const TAB_WINDOW_RADIUS = 12;
/** The frame's hairline when the window has no stroke of its own. */
export const TAB_WINDOW_HAIRLINE = '#cbd5e1';
/** The frame's ground and words, on each paper. */
export const TAB_WINDOW_EMPTY = {
  light: { fill: '#f8fafc', ink: '#64748b' },
  dark: { fill: '#1e293b', ink: '#94a3b8' },
} as const;

/** What an export knows of a stored window's tab: its name. */
export type TabWindowArt = { name: string };

/** A stored window named for the tab it showed, as the canvas and the export both draw it. */
export function tabWindowNames(tabs: readonly { id: string; name: string }[]): ResolveTabWindow {
  return (el) => {
    const t = el.windowTabId ? tabs.find((x) => x.id === el.windowTabId) : undefined;
    return t ? { name: t.name || 'Untitled tab' } : undefined;
  };
}

/** Resolves a window to its tab's name, or undefined for a window with no tab (or one the caller doesn't know). */
export type ResolveTabWindow = (el: TabWindowElement) => TabWindowArt | undefined;

/** What a stored window reads of its element: its box, and the tab it showed. */
export type TabWindowElement = {
  type: 'shape';
  x: number;
  y: number;
  width: number;
  height: number;
  windowTabId?: string;
};

/** A stored window in an export: its rounded frame named for its tab ("Tab Window" when unknown). */
export function svgTabWindow(
  el: TabWindowElement,
  art: TabWindowArt | undefined,
  stroke: string | undefined,
  surface: CanvasSurface = 'light',
  // Under Sketch the frame is drawn by hand (docs/specs/008-canvas/finish.md).
  sketched = false,
  // The element's resolved face, for the frame's name, as on the canvas.
  fontFamily = 'system-ui, sans-serif',
): string {
  const box = `x="${r2(el.x)}" y="${r2(el.y)}" width="${r2(el.width)}" height="${r2(el.height)}"`;
  const radius = Math.min(TAB_WINDOW_RADIUS, el.width / 2, el.height / 2);
  const rect = (fill: string, extra = '') =>
    `<rect ${box} rx="${r2(radius)}" fill="${xmlEscape(fill)}"${extra}/>`;
  const hairline = rect(
    'none',
    ` stroke="${xmlEscape(stroke ?? TAB_WINDOW_HAIRLINE)}" stroke-width="1"`,
  );
  const edge = sketched ? `<g filter="url(#${SKETCH_FACE_FILTER.id})">${hairline}</g>` : hairline;
  const name = art?.name ?? 'Tab Window';
  const size = Math.max(10, Math.min(16, el.height / 6));
  return (
    rect(TAB_WINDOW_EMPTY[surface].fill) +
    `<text x="${r2(el.x + el.width / 2)}" y="${r2(el.y + el.height / 2)}" font-family="${xmlEscape(fontFamily)}" font-size="${r2(size)}" font-weight="600" fill="${TAB_WINDOW_EMPTY[surface].ink}" text-anchor="middle" dominant-baseline="central">${xmlEscape(name)}</text>` +
    edge
  );
}
