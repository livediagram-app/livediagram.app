// A wireframe device frame's paint and parts (docs/specs/007-editor/wireframe-pages.md "Frame looks"):
// each look's colours (Theme from the tab's theme), a line-drawn part under Outline, Sketch or Marker,
// and the filled pieces (a rounded part, a body's rim and bezel) the frames are built from. Shared by
// the frame under the screen (wireframe-device-svg.ts) and what is drawn over it
// (wireframe-frame-over.ts).
import { r2 } from './svg-render-primitives';
import { isLightColor, shade } from './colors';
import { mixHex } from '@liveworkspace/model-core/color-wash';
import type { Finish } from './finish';
import { MARKER_INK_OPACITY, markerStrokes } from './marker';
import { outlineOfPath, sketchStrokes } from './sketch';
import { fnv1aString } from '@liveworkspace/model-core/string-hash';
import {
  deviceScreenPath,
  roundedRectPath,
  type DeviceGeometry,
  type WireframeFrameLook,
} from './wireframe-device';

export type Paint = {
  // The body's outer edge and the bezel inside it.
  rim: string;
  bezel: string;
  // Buttons, a laptop's base, a monitor's chin and stand, a watch's band.
  metal: string;
  metalEdge: string;
  // A browser's toolbar, its address field and the words in it.
  toolbar: string;
  field: string;
  fieldText: string;
  // The thin line between the toolbar and the page, and round the window.
  hairline: string;
  // Outline: every part a line in this ink, nothing filled.
  line?: string;
  // Sketch or Marker (the tab's finish): every line drawn by hand, with that pen.
  hand?: 'sketch' | 'marker';
};

export const circleD = (cx: number, cy: number, r: number) =>
  `M${r2(cx - r)} ${r2(cy)}A${r} ${r} 0 1 0 ${r2(cx + r)} ${r2(cy)}A${r} ${r} 0 1 0 ${r2(cx - r)} ${r2(cy)}Z`;

// The frame's pencil and felt-tip widths, px (a Marker outline's nib, docs/specs/008-canvas/finish.md).
const SKETCH_FRAME_PX = 1.4;
const MARKER_FRAME_PX = 3;

/** One line of a line-drawn frame (Outline, Sketch or Marker): `d` stroked in the look's ink, by hand
 *  under a hand-drawn finish (Sketch's two pencil passes, Marker's felt-tip layers), seeded by its
 *  own path so it draws the same everywhere. */
export function lineArt(paint: Paint, d: string, width: number, extra = ''): string {
  const ink = paint.line ?? '#334155';
  const round = 'fill="none" stroke-linecap="round" stroke-linejoin="round"';
  if (paint.hand === 'sketch')
    return `<path d="${sketchStrokes(outlineOfPath(d), fnv1aString(d))}" ${round} stroke="${ink}" stroke-width="${SKETCH_FRAME_PX}"/>`;
  if (paint.hand === 'marker') {
    const [a, b] = markerStrokes(outlineOfPath(d), fnv1aString(d));
    return [a, b]
      .filter(Boolean)
      .map(
        (layer) =>
          `<path d="${layer}" ${round} stroke="${ink}" stroke-opacity="${MARKER_INK_OPACITY}" stroke-width="${Math.max(width, MARKER_FRAME_PX)}"/>`,
      )
      .join('');
  }
  return `<path d="${d}" fill="none" stroke="${ink}" stroke-width="${width}"${extra}/>`;
}

// The colours a Theme frame is drawn from (wireframeFrameTheme): the tab theme's element stroke as
// the device's colour, its canvas, and its element fill and text for a browser's address field.
export type WireframeFrameTheme = {
  accent: string;
  background: string;
  fill?: string | null;
  text?: string | null;
  // The tab's finish: Sketch and Marker draw the frame by hand, as lines.
  finish?: Finish;
};

// A Theme frame with no theme to hand: the slate the default scheme draws in.
const NEUTRAL_THEME: WireframeFrameTheme = { accent: '#334155', background: '#f8fafc' };

const HEX = /^#[0-9a-f]{6}$/i;
const hexOr = (v: string | null | undefined, fallback: string) => (v && HEX.test(v) ? v : fallback);

// The device in the theme's colour (docs/specs/007-editor/wireframe-pages.md "Choosing the
// device"): its edge the accent, its bezel the accent near black, its buttons and stands the accent
// darkened; a browser's toolbar the canvas washed with the accent, its field the element fill.
function themePaint(t: WireframeFrameTheme): Paint {
  const accent = hexOr(t.accent, NEUTRAL_THEME.accent);
  const background = hexOr(t.background, NEUTRAL_THEME.background);
  const toolbar = mixHex(accent, background, 0.12);
  const light = isLightColor(toolbar);
  return {
    rim: accent,
    bezel: shade(accent, 0.82),
    metal: shade(accent, 0.35),
    metalEdge: shade(accent, 0.15),
    toolbar,
    field: hexOr(t.fill, light ? '#ffffff' : shade(toolbar, 0.25)),
    fieldText: hexOr(t.text, light ? '#334155' : '#e2e8f0'),
    hairline: mixHex(accent, toolbar, 0.3),
  };
}

// A hand-drawn frame's ink, by look: the theme's accent, else a graphite, a soft or an outline grey.
const HAND_INK: Record<Exclude<WireframeFrameLook, 'theme'>, string> = {
  dark: '#1f2937',
  light: '#94a3b8',
  outline: '#94a3b8',
};

/** A look's paint: Theme from the tab's theme colours, the rest fixed; under a hand-drawn finish
 *  (Sketch, Marker) a line drawing in the look's ink, drawn with that finish's pen
 *  (docs/specs/007-editor/wireframe-pages.md "Frame looks"). */
export function framePaint(look: WireframeFrameLook, theme?: WireframeFrameTheme): Paint {
  const finish = theme?.finish;
  if (finish === 'sketch' || finish === 'marker') {
    const ink = look === 'theme' ? hexOr(theme?.accent, NEUTRAL_THEME.accent) : HAND_INK[look];
    return { ...PAINT.outline, line: ink, hairline: ink, fieldText: ink, hand: finish };
  }
  return look === 'theme' ? themePaint(theme ?? NEUTRAL_THEME) : PAINT[look];
}

/** A theme's colours as a Theme frame reads them. */
export function wireframeFrameTheme(theme: {
  elementStroke: string | null;
  elementFill: string | null;
  elementText: string | null;
  backgroundColor: string;
  rootColor?: { stroke?: string };
}): WireframeFrameTheme {
  return {
    accent: theme.elementStroke ?? theme.rootColor?.stroke ?? NEUTRAL_THEME.accent,
    background: theme.backgroundColor,
    fill: theme.elementFill,
    text: theme.elementText,
  };
}

const PAINT: Record<Exclude<WireframeFrameLook, 'theme'>, Paint> = {
  dark: {
    rim: '#3a3b41',
    bezel: '#0a0a0b',
    metal: '#2c2d32',
    metalEdge: '#4a4b52',
    toolbar: '#2b2c30',
    field: '#1c1d20',
    fieldText: '#d4d4d8',
    hairline: '#18181b',
  },
  light: {
    rim: '#c7c9cf',
    bezel: '#fbfbfc',
    metal: '#d9dbe0',
    metalEdge: '#b4b7be',
    toolbar: '#eef0f3',
    field: '#ffffff',
    fieldText: '#334155',
    hairline: '#d4d7dd',
  },
  outline: {
    rim: 'none',
    bezel: 'none',
    metal: 'none',
    metalEdge: 'none',
    toolbar: 'none',
    field: 'none',
    fieldText: '#64748b',
    hairline: '#94a3b8',
    line: '#94a3b8',
  },
};

// The status bar's font: the export's own Inter first (render-png carries it).
export const BAR_FONT = 'Inter, system-ui, -apple-system, Segoe UI, sans-serif';
// The time a status bar shows, and the watch's.

export const OUTLINE_WIDTH = 2;

export type Rect = { x: number; y: number; width: number; height: number };

export const shift = (r: Rect, ox: number, oy: number): Rect => ({
  ...r,
  x: r.x + ox,
  y: r.y + oy,
});

export function rrect(
  r: Rect,
  radius: number | readonly [number, number, number, number],
  fill: string,
) {
  const radii = typeof radius === 'number' ? ([radius, radius, radius, radius] as const) : radius;
  return `<path d="${roundedRectPath(r, radii)}" fill="${fill}"/>`;
}

// A part filled in a look's paint, or (Outline) drawn as a line.
export function part(
  paint: Paint,
  r: Rect,
  radius: number | readonly [number, number, number, number],
  fill: string,
) {
  if (!paint.line) return rrect(r, radius, fill);
  const radii = typeof radius === 'number' ? ([radius, radius, radius, radius] as const) : radius;
  return lineArt(paint, roundedRectPath(r, radii), OUTLINE_WIDTH);
}

// A body: its rim, then its bezel inset by the rim's width.
export function body(paint: Paint, r: Rect, radius: number, rim = 2.5): string {
  if (paint.line) return part(paint, r, radius, 'none');
  const inner = {
    x: r.x + rim,
    y: r.y + rim,
    width: r.width - 2 * rim,
    height: r.height - 2 * rim,
  };
  return rrect(r, radius, paint.rim) + rrect(inner, Math.max(0, radius - rim), paint.bezel);
}

// The screen's own edge (Outline only: a filled bezel already shows it).
export function screenEdge(paint: Paint, g: DeviceGeometry): string {
  if (!paint.line) return '';
  return lineArt(paint, deviceScreenPath(g), 1.5);
}

// The portrait art placed at the page's corner, turned a quarter anticlockwise for landscape (its
// top to the left): (x, y) in the upright frame lands at (y, W - x), W the upright frame's width.
export function placeTransform(g: DeviceGeometry, ox: number, oy: number): string {
  if (!g.landscape) return `translate(${r2(ox)} ${r2(oy)})`;
  return `translate(${r2(ox)} ${r2(oy)}) matrix(0 -1 1 0 0 ${r2(g.height)})`;
}
