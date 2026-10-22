// The tab window (docs/specs/009-elements/tab-window.md): an element showing another tab of the document, live,
// zoomed to fit. Pure: which tabs a window may show, its sizes, and its picture in an export (the shown tab's drawing
// fitted inside a rounded frame, or the frame named for its tab where there is no drawing).
import type { BoxedElement } from './index';
import type { CanvasSurface } from './colors';
import { r2, xmlEscape } from './svg-render-primitives';
import { SKETCH_FACE_FILTER } from './svg-render-sketch';

/** A window's size as it lands (16:9). */
export const TAB_WINDOW_SIZE = { width: 640, height: 360 } as const;
/** Its rounded corners. */
export const TAB_WINDOW_RADIUS = 12;
/** The frame's hairline when the window has no stroke of its own. */
export const TAB_WINDOW_HAIRLINE = '#cbd5e1';
/** The ground and words of a window with no drawing (empty, loading or unavailable), on each paper. */
export const TAB_WINDOW_EMPTY = {
  light: { fill: '#f8fafc', ink: '#64748b' },
  dark: { fill: '#1e293b', ink: '#94a3b8' },
} as const;

type TabLike = { id: string; kind?: string };

/** Whether a window on `ownTabId` may show this tab: any tab of the document but its own, a Plan tab (a Board, Sheet
 *  or Dashboard tab, or any tab in Plan mode) included. */
export function tabWindowMayShow(tab: TabLike, ownTabId: string | undefined): boolean {
  return tab.id !== ownTabId;
}

/** The tabs a window on `ownTabId` may show, in tab-bar order. */
export function tabWindowOffers<T extends TabLike>(
  tabs: readonly T[],
  ownTabId: string | undefined,
): T[] {
  return tabs.filter((t) => tabWindowMayShow(t, ownTabId));
}

/** Every id in `markup` (and every `url(#…)` and `href="#…"` reaching one) prefixed, so a drawing set inside another
 *  never shares a gradient, pattern, marker or clip with it. */
export function prefixSvgIds(markup: string, prefix: string): string {
  const ids = new Set<string>();
  for (const m of markup.matchAll(/\sid="([^"]+)"/g)) ids.add(m[1]!);
  if (ids.size === 0) return markup;
  const p = (id: string) => (ids.has(id) ? `${prefix}${id}` : id);
  return markup
    .replace(/(\sid=")([^"]+)(")/g, (_, a: string, id: string, b: string) => `${a}${p(id)}${b}`)
    .replace(/url\(#([^)]+)\)/g, (_, id: string) => `url(#${p(id)})`)
    .replace(/(href=")#([^"]+)(")/g, (_, a: string, id: string, b: string) => `${a}#${p(id)}${b}`);
}

/** A shown tab drawn for a window: the export renderer's SVG and its own size, and the tab's paper. */
export type TabWindowDrawing = {
  markup: string;
  width: number;
  height: number;
  background: string;
};

/** What an export knows of a window's tab: its name, and its drawing when there is one. */
export type TabWindowArt = { name: string; drawing?: TabWindowDrawing };

/** A window drawn inside another tab, named for the tab it shows (no drawing: it is a frame there), as the canvas and
 *  the export both draw it. */
export function tabWindowNames(tabs: readonly { id: string; name: string }[]): ResolveTabWindow {
  return (el) => {
    const t = el.windowTabId ? tabs.find((x) => x.id === el.windowTabId) : undefined;
    return t ? { name: t.name || 'Untitled tab' } : undefined;
  };
}

/** Resolves a window to what its tab is, or undefined for a window with no tab (or one the caller doesn't know). */
export type ResolveTabWindow = (el: BoxedElement & { type: 'shape' }) => TabWindowArt | undefined;

/** A window in an export: the shown tab's drawing fitted and centred inside its rounded frame, over the tab's paper;
 *  without one, the frame named for its tab ("Tab Window" when unknown). */
export function svgTabWindow(
  el: BoxedElement & { type: 'shape' },
  art: TabWindowArt | undefined,
  stroke: string | undefined,
  surface: CanvasSurface = 'light',
  // Under Sketch the frame is drawn by hand; the tab it shows keeps its own finish (docs/specs/008-canvas/finish.md).
  sketched = false,
  // The element's resolved face, for the empty frame's message, as on the canvas.
  fontFamily = 'system-ui, sans-serif',
): string {
  const id = `tw-${el.id}`.replace(/[^a-zA-Z0-9-]/g, '');
  const box = `x="${r2(el.x)}" y="${r2(el.y)}" width="${r2(el.width)}" height="${r2(el.height)}"`;
  const radius = Math.min(TAB_WINDOW_RADIUS, el.width / 2, el.height / 2);
  const rect = (fill: string, extra = '') =>
    `<rect ${box} rx="${r2(radius)}" fill="${xmlEscape(fill)}"${extra}/>`;
  const hairline = rect(
    'none',
    ` stroke="${xmlEscape(stroke ?? TAB_WINDOW_HAIRLINE)}" stroke-width="1"`,
  );
  const edge = sketched ? `<g filter="url(#${SKETCH_FACE_FILTER.id})">${hairline}</g>` : hairline;
  const drawing = art?.drawing;
  if (!drawing) {
    const name = art?.name ?? 'Tab Window';
    const size = Math.max(10, Math.min(16, el.height / 6));
    return (
      rect(TAB_WINDOW_EMPTY[surface].fill) +
      `<text x="${r2(el.x + el.width / 2)}" y="${r2(el.y + el.height / 2)}" font-family="${xmlEscape(fontFamily)}" font-size="${r2(size)}" font-weight="600" fill="${TAB_WINDOW_EMPTY[surface].ink}" text-anchor="middle" dominant-baseline="central">${xmlEscape(name)}</text>` +
      edge
    );
  }
  return (
    `<clipPath id="${id}-clip"><rect ${box} rx="${r2(radius)}"/></clipPath>` +
    `<g clip-path="url(#${id}-clip)">` +
    rect(drawing.background) +
    `<svg ${box} viewBox="0 0 ${r2(drawing.width)} ${r2(drawing.height)}" preserveAspectRatio="xMidYMid meet">` +
    prefixSvgIds(drawing.markup, `${id}-`) +
    `</svg></g>` +
    edge
  );
}
