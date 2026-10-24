// A wireframe page's device frame as SVG (docs/specs/007-editor/wireframe-pages.md): the frame
// UNDER the screen (body, bezel, buttons, a camera in the bezel, a laptop's base, a monitor's
// stand, a browser's toolbar, a watch's case and band) and what is drawn OVER the screen's
// content (the Dynamic Island or punch-hole camera, the status bar, the home indicator). One
// markup for the canvas (inlined into its sheet and overlay), every export and the agents'
// previews, so they draw the same frame. Pure strings in canvas coordinates; no DOM.
import { r2, xmlEscape } from './svg-render-primitives';
import { isLightColor, shade } from './colors';
import { mixHex } from '@liveworkspace/model-core/color-wash';
import type { Finish } from './finish';
import { MARKER_INK_OPACITY, markerStrokes } from './marker';
import { outlineOfPath, sketchStrokes } from './sketch';
import { fnv1aString } from '@liveworkspace/model-core/string-hash';
import {
  ANDROID,
  ANDROID_TABLET,
  BROWSER,
  DESKTOP,
  DUO,
  IPAD,
  IPHONE,
  LAPTOP,
  WATCH,
  WIREFRAME_DEVICES,
  deviceScreenPath,
  roundedRectPath,
  wireframeAddress,
  type DeviceGeometry,
  type WireframeFrameLook,
} from './wireframe-device';

type Paint = {
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

const circleD = (cx: number, cy: number, r: number) =>
  `M${r2(cx - r)} ${r2(cy)}A${r} ${r} 0 1 0 ${r2(cx + r)} ${r2(cy)}A${r} ${r} 0 1 0 ${r2(cx - r)} ${r2(cy)}Z`;

// The frame's pencil and felt-tip widths, px (a Marker outline's nib, docs/specs/008-canvas/finish.md).
const SKETCH_FRAME_PX = 1.4;
const MARKER_FRAME_PX = 3;

/** One line of a line-drawn frame (Outline, Sketch or Marker): `d` stroked in the look's ink, by hand
 *  under a hand-drawn finish (Sketch's two pencil passes, Marker's felt-tip layers), seeded by its
 *  own path so it draws the same everywhere. */
function lineArt(paint: Paint, d: string, width: number, extra = ''): string {
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
function framePaint(look: WireframeFrameLook, theme?: WireframeFrameTheme): Paint {
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
const BAR_FONT = 'Inter, system-ui, -apple-system, Segoe UI, sans-serif';
// The time a status bar shows, and the watch's.
const STATUS_TIME = '9:41';
const WATCH_TIME = '10:09';

const OUTLINE_WIDTH = 2;

type Rect = { x: number; y: number; width: number; height: number };

const shift = (r: Rect, ox: number, oy: number): Rect => ({ ...r, x: r.x + ox, y: r.y + oy });

function rrect(r: Rect, radius: number | readonly [number, number, number, number], fill: string) {
  const radii = typeof radius === 'number' ? ([radius, radius, radius, radius] as const) : radius;
  return `<path d="${roundedRectPath(r, radii)}" fill="${fill}"/>`;
}

// A part filled in a look's paint, or (Outline) drawn as a line.
function part(
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
function body(paint: Paint, r: Rect, radius: number, rim = 2.5): string {
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
function screenEdge(paint: Paint, g: DeviceGeometry): string {
  if (!paint.line) return '';
  return lineArt(paint, deviceScreenPath(g), 1.5);
}

// ---- Under the screen ------------------------------------------------------------------------

/** The frame drawn under the screen, at the page's top-left (`ox`, `oy`). */
export function wireframeFrameUnderSvg(
  g: DeviceGeometry,
  look: WireframeFrameLook,
  ox: number,
  oy: number,
  name?: string,
  theme?: WireframeFrameTheme,
): string {
  const paint = framePaint(look, theme);
  const art = portraitFrame(g, paint, name);
  return `<g transform="${placeTransform(g, ox, oy)}">${art}</g>${shiftedScreenEdge(paint, g, ox, oy)}`;
}

function shiftedScreenEdge(paint: Paint, g: DeviceGeometry, ox: number, oy: number) {
  return screenEdge(paint, {
    ...g,
    screen: shift(g.screen, ox, oy),
  });
}

// The portrait art placed at the page's corner, turned a quarter anticlockwise for landscape (its
// top to the left): (x, y) in the upright frame lands at (y, W - x), W the upright frame's width.
function placeTransform(g: DeviceGeometry, ox: number, oy: number): string {
  if (!g.landscape) return `translate(${r2(ox)} ${r2(oy)})`;
  return `translate(${r2(ox)} ${r2(oy)}) matrix(0 -1 1 0 0 ${r2(g.height)})`;
}

// The frame upright, from its top-left.
function portraitFrame(g: DeviceGeometry, paint: Paint, name?: string): string {
  const W = g.landscape ? g.height : g.width;
  const H = g.landscape ? g.width : g.height;
  switch (g.device) {
    case 'iphone':
    case 'android':
      return phoneFrame(g.device, W, H, paint);
    case 'iphone-duo':
      return duoFrame(W, H, paint);
    case 'ipad':
    case 'android-tablet': {
      const t = g.device === 'ipad' ? IPAD : ANDROID_TABLET;
      return (
        body(paint, { x: 0, y: 0, width: W, height: H }, t.bodyRadius, 3) +
        cameraDot(paint, W / 2, t.bezel / 2, 4)
      );
    }
    case 'laptop':
      return laptopFrame(W, H, paint);
    case 'desktop':
      return desktopFrame(W, H, paint);
    case 'browser':
      return browserFrame(W, H, paint, name);
    case 'watch':
      return watchFrame(W, H, paint);
  }
}

function phoneFrame(device: 'iphone' | 'android', W: number, H: number, paint: Paint): string {
  const spec = device === 'iphone' ? IPHONE : ANDROID;
  const side = 3;
  // The side buttons, standing out of the body by `side`: each a run down one edge.
  const buttons =
    device === 'iphone'
      ? [
          { left: true, y: 118, h: 32 },
          { left: true, y: 178, h: 62 },
          { left: true, y: 254, h: 62 },
          { left: false, y: 206, h: 98 },
        ]
      : [
          { left: false, y: 168, h: 96 },
          { left: false, y: 290, h: 58 },
        ];
  const knobs = buttons
    .map((b) =>
      part(
        paint,
        { x: b.left ? 0 : W - side - 1.5, y: b.y, width: side + 1.5, height: b.h },
        1.5,
        paint.metal,
      ),
    )
    .join('');
  return knobs + body(paint, { x: side, y: 0, width: W - 2 * side, height: H }, spec.bodyRadius, 3);
}

// The iPhone Duo opened, upright (turned, the usual way it is held, the fold runs top to bottom): one
// body round its one screen, the fold across its middle marked where it meets the frame's edges,
// the side buttons on the half that is the phone when closed.
function duoFrame(W: number, H: number, paint: Paint): string {
  const side = 3;
  const knob = (x: number, y: number, h: number) =>
    part(paint, { x, y, width: side + 1.5, height: h }, 1.5, paint.metal);
  const knobs = knob(W - side - 1.5, 96, 70) + knob(W - side - 1.5, 186, 46) + knob(0, 120, 40);
  // The hinge's ends: a short notch either side of the body at the fold.
  const fold = H / 2;
  const notch = (x: number) =>
    part(paint, { x, y: fold - 14, width: side + 1.5, height: 28 }, 1.5, paint.metalEdge);
  return (
    knobs +
    body(paint, { x: side, y: 0, width: W - 2 * side, height: H }, DUO.bodyRadius, 3) +
    notch(0) +
    notch(W - side - 1.5)
  );
}

function cameraDot(paint: Paint, cx: number, cy: number, r: number): string {
  if (paint.line) return lineArt(paint, circleD(cx, cy, r), 1.2);
  return (
    `<circle cx="${r2(cx)}" cy="${r2(cy)}" r="${r}" fill="${paint.metalEdge}"/>` +
    `<circle cx="${r2(cx)}" cy="${r2(cy)}" r="${r2(r * 0.5)}" fill="#111827"/>`
  );
}

function laptopFrame(W: number, H: number, paint: Paint): string {
  const lidW = W - 2 * LAPTOP.baseOverhang;
  const lidH = H - LAPTOP.baseHeight;
  const lid = { x: LAPTOP.baseOverhang, y: 0, width: lidW, height: lidH };
  const r = LAPTOP.lidRadius;
  const lidArt = paint.line
    ? part(paint, lid, [r, r, 4, 4], 'none')
    : rrect(lid, [r, r, 4, 4], paint.rim) +
      rrect(
        { x: lid.x + 3, y: 3, width: lidW - 6, height: lidH - 3 },
        [r - 3, r - 3, 0, 0],
        paint.bezel,
      );
  const base = { x: 0, y: lidH, width: W, height: LAPTOP.baseHeight };
  const notchW = 200;
  const notch = { x: W / 2 - notchW / 2, y: lidH, width: notchW, height: 9 };
  const baseArt = paint.line
    ? part(paint, base, [3, 3, 14, 14], 'none') + part(paint, notch, [0, 0, 5, 5], 'none')
    : rrect(base, [3, 3, 14, 14], paint.metal) +
      `<rect x="0" y="${r2(lidH)}" width="${r2(W)}" height="2" fill="${paint.metalEdge}"/>` +
      rrect(notch, [0, 0, 5, 5], paint.metalEdge);
  return lidArt + cameraDot(paint, W / 2, LAPTOP.top / 2, 3.5) + baseArt;
}

function desktopFrame(W: number, H: number, paint: Paint): string {
  const monitorH = H - DESKTOP.neckHeight - DESKTOP.footHeight;
  const monitor = { x: 0, y: 0, width: W, height: monitorH };
  const r = DESKTOP.radius;
  const chin = { x: 0, y: monitorH - DESKTOP.chin, width: W, height: DESKTOP.chin };
  const neckTop = DESKTOP.neckWidth * 0.78;
  const cx = W / 2;
  const neck =
    `M${r2(cx - neckTop / 2)} ${r2(monitorH)}L${r2(cx + neckTop / 2)} ${r2(monitorH)}` +
    `L${r2(cx + DESKTOP.neckWidth / 2)} ${r2(monitorH + DESKTOP.neckHeight)}` +
    `L${r2(cx - DESKTOP.neckWidth / 2)} ${r2(monitorH + DESKTOP.neckHeight)}Z`;
  const foot = {
    x: cx - DESKTOP.footWidth / 2,
    y: monitorH + DESKTOP.neckHeight,
    width: DESKTOP.footWidth,
    height: DESKTOP.footHeight,
  };
  if (paint.line) {
    return (
      lineArt(paint, neck, OUTLINE_WIDTH) +
      part(paint, foot, 10, 'none') +
      part(paint, monitor, r, 'none') +
      lineArt(paint, `M0 ${r2(chin.y)}H${r2(W)}`, 1.5)
    );
  }
  return (
    `<path d="${neck}" fill="${paint.metal}"/>` +
    `<path d="${neck}" fill="#000" fill-opacity="0.12"/>` +
    rrect(foot, 10, paint.metal) +
    `<rect x="${r2(foot.x + 10)}" y="${r2(foot.y)}" width="${r2(foot.width - 20)}" height="2" fill="${paint.metalEdge}"/>` +
    body(paint, monitor, r, 3) +
    rrect(
      { ...chin, x: 3, width: W - 6, height: chin.height - 3 },
      [0, 0, r - 3, r - 3],
      paint.metal,
    )
  );
}

// Back, forward and reload as strokes, the address field with its lock and address, a menu.
function browserFrame(W: number, H: number, paint: Paint, name?: string): string {
  const window = { x: 0.5, y: 0.5, width: W - 1, height: H - 1 };
  const T = BROWSER.toolbar;
  const ink = paint.line ?? paint.fieldText;
  const parts: string[] = [];
  if (paint.line) {
    parts.push(part(paint, window, BROWSER.radius, 'none'));
  } else {
    parts.push(
      `<path d="${roundedRectPath(window, [BROWSER.radius, BROWSER.radius, BROWSER.radius, BROWSER.radius])}" fill="${paint.toolbar}" stroke="${paint.hairline}" stroke-width="1"/>`,
    );
  }
  parts.push(
    `<line x1="0" y1="${r2(T - 0.5)}" x2="${r2(W)}" y2="${r2(T - 0.5)}" stroke="${paint.hairline}" stroke-width="1"/>`,
  );
  const cy = T / 2;
  const lights = ['#ff5f57', '#febc2e', '#28c840'];
  lights.forEach((c, i) => {
    const cx = 22 + i * 20;
    parts.push(
      paint.line
        ? lineArt(paint, circleD(cx, cy, 6), 1.2)
        : `<circle cx="${cx}" cy="${r2(cy)}" r="6" fill="${c}"/>`,
    );
  });
  const stroke = `fill="none" stroke="${ink}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"`;
  parts.push(
    `<path d="M108 ${r2(cy - 6)}L102 ${r2(cy)}L108 ${r2(cy + 6)}" ${stroke}/>`,
    `<path d="M132 ${r2(cy - 6)}L138 ${r2(cy)}L132 ${r2(cy + 6)}" ${stroke} stroke-opacity="0.45"/>`,
    `<path d="M171 ${r2(cy - 4)}A6.5 6.5 0 1 0 172 ${r2(cy + 2)}" ${stroke}/>`,
    `<path d="M168 ${r2(cy - 8)}L172 ${r2(cy - 4)}L167 ${r2(cy - 1.5)}" ${stroke}/>`,
  );
  const fieldX = 200;
  const fieldW = Math.max(120, W - fieldX - 80);
  const field = { x: fieldX, y: cy - 15, width: fieldW, height: 30 };
  parts.push(
    paint.line
      ? lineArt(paint, roundedRectPath(field, [15, 15, 15, 15]), 1.5)
      : `<path d="${roundedRectPath(field, [15, 15, 15, 15])}" fill="${paint.field}" stroke="${paint.hairline}" stroke-width="1"/>`,
  );
  // The lock: a shackle over a body.
  const lx = fieldX + 18;
  parts.push(
    `<path d="M${lx - 3} ${r2(cy - 1)}V${r2(cy - 4)}A3 3 0 0 1 ${lx + 3} ${r2(cy - 4)}V${r2(cy - 1)}" ${stroke} stroke-width="1.4"/>`,
    `<rect x="${lx - 5}" y="${r2(cy - 1)}" width="10" height="7.5" rx="1.6" fill="${ink}"/>`,
    `<text x="${fieldX + 32}" y="${r2(cy + 4.5)}" font-family="${BAR_FONT}" font-size="13" fill="${ink}">${xmlEscape(wireframeAddress(name))}</text>`,
  );
  // The menu: three dots.
  for (let i = -1; i <= 1; i += 1)
    parts.push(`<circle cx="${r2(W - 34)}" cy="${r2(cy + i * 5.5)}" r="1.7" fill="${ink}"/>`);
  return parts.join('');
}

function watchFrame(W: number, H: number, paint: Paint): string {
  const caseW = W - 2 * WATCH.crownRoom;
  const caseH = H - 2 * WATCH.band;
  const x = WATCH.crownRoom;
  const y = WATCH.band;
  const bandTop = 150;
  const bandEnd = 128;
  const cx = W / 2;
  const band = (y0: number, y1: number) =>
    `M${r2(cx - bandTop / 2)} ${r2(y1)}L${r2(cx - bandEnd / 2)} ${r2(y0)}` +
    `L${r2(cx + bandEnd / 2)} ${r2(y0)}L${r2(cx + bandTop / 2)} ${r2(y1)}Z`;
  const bands = [band(0, y + 12), band(H, y + caseH - 12)];
  const crown = { x: x + caseW - 4, y: y + caseH * 0.27, width: WATCH.crownRoom + 4, height: 44 };
  const button = { x: x + caseW - 4, y: y + caseH * 0.52, width: WATCH.crownRoom, height: 36 };
  if (paint.line) {
    return (
      bands.map((d) => lineArt(paint, d, OUTLINE_WIDTH)).join('') +
      part(paint, crown, 4, 'none') +
      part(paint, button, 3, 'none') +
      part(paint, { x, y, width: caseW, height: caseH }, WATCH.caseRadius, 'none')
    );
  }
  const grooves = [0.25, 0.42, 0.58, 0.75]
    .map(
      (f) =>
        `<rect x="${r2(crown.x + 5)}" y="${r2(crown.y + crown.height * f - 0.75)}" width="${r2(crown.width - 6)}" height="1.5" fill="${paint.metalEdge}"/>`,
    )
    .join('');
  return (
    bands.map((d) => `<path d="${d}" fill="${paint.metal}"/>`).join('') +
    rrect(crown, 4, paint.metal) +
    grooves +
    rrect(button, 3, paint.metal) +
    body(paint, { x, y, width: caseW, height: caseH }, WATCH.caseRadius, 3)
  );
}

// ---- Over the screen -------------------------------------------------------------------------

/**
 * What is drawn over the screen's content, at the page's top-left: the camera that sits in the
 * screen (the Dynamic Island, the punch hole) and, while `systemBars`, the status bar and home
 * indicator in ink for the screen (`dark`: the screen's background is dark).
 */
export function wireframeFrameOverSvg(
  g: DeviceGeometry,
  look: WireframeFrameLook,
  ox: number,
  oy: number,
  { systemBars, dark, theme }: { systemBars: boolean; dark: boolean; theme?: WireframeFrameTheme },
): string {
  const paint = framePaint(look, theme);
  const parts: string[] = [];
  const camera = screenCamera(g, paint);
  if (camera) parts.push(`<g transform="${placeTransform(g, ox, oy)}">${camera}</g>`);
  if (systemBars) parts.push(systemBarsSvg(g, shift(g.screen, ox, oy), dark));
  return parts.join('');
}

// The camera inside the screen, upright, from the frame's top-left.
function screenCamera(g: DeviceGeometry, paint: Paint): string {
  const W = g.landscape ? g.height : g.width;
  const upright = g.landscape ? { y: g.screen.x } : { y: g.screen.y };
  const top = upright.y;
  if (g.device === 'iphone-duo') {
    // Its camera is under the display: what shows is the fold, a faint crease across the middle.
    const H = g.landscape ? g.width : g.height;
    const x = g.landscape ? g.height - g.screen.y - g.screen.height : g.screen.x;
    const w = g.landscape ? g.screen.height : g.screen.width;
    // Outline marks the fold dashed; any other look (a hand-drawn one too) as the faint crease it is.
    return paint.line && !paint.hand
      ? lineArt(paint, `M${r2(x)} ${r2(H / 2)}H${r2(x + w)}`, 1, ' stroke-dasharray="4 4"')
      : `<rect x="${r2(x)}" y="${r2(H / 2 - 0.75)}" width="${r2(w)}" height="1.5" fill="#0f172a" fill-opacity="0.06"/>`;
  }
  if (g.device === 'iphone') {
    const { width, height, top: at } = IPHONE.island;
    const mid = W / 2;
    const r = { x: mid - width / 2, y: top + at, width, height };
    return paint.line
      ? lineArt(paint, roundedRectPath(r, [height / 2, height / 2, height / 2, height / 2]), 1.5)
      : rrect(r, height / 2, '#000000');
  }
  if (g.device === 'android') {
    const { r, top: at } = ANDROID.camera;
    return paint.line
      ? lineArt(paint, circleD(W / 2, top + at, r), 1.5)
      : `<circle cx="${r2(W / 2)}" cy="${r2(top + at)}" r="${r}" fill="#000000"/>`;
  }
  return '';
}

function systemBarsSvg(g: DeviceGeometry, s: Rect, dark: boolean): string {
  const ink = dark ? '#ffffff' : '#0f172a';
  const cls = WIREFRAME_DEVICES[g.device].deviceClass;
  const parts: string[] = [];
  const time = (
    x: number,
    y: number,
    size: number,
    anchor: 'start' | 'middle' | 'end',
    t = STATUS_TIME,
  ) =>
    `<text x="${r2(x)}" y="${r2(y)}" font-family="${BAR_FONT}" font-size="${size}" font-weight="600" text-anchor="${anchor}" fill="${ink}">${t}</text>`;
  if (g.bars.top > 0) {
    if (g.device === 'iphone') {
      const ear = (s.width - IPHONE.island.width) / 4;
      parts.push(time(s.x + ear + 6, s.y + 35, 17, 'middle'));
      parts.push(statusIcons(s.x + s.width - ear + 40, s.y + 29, 1, ink));
    } else if (g.device === 'iphone-duo') {
      // As an iPad's: the time at the left, the icons at the right.
      parts.push(time(s.x + 26, s.y + 21, 14, 'start'));
      parts.push(statusIcons(s.x + s.width - 24, s.y + 16, 0.8, ink));
    } else if (g.device === 'android') {
      parts.push(time(s.x + 24, s.y + 24, 14, 'start'));
      parts.push(statusIcons(s.x + s.width - 22, s.y + 19, 0.82, ink));
    } else if (cls === 'tablet') {
      parts.push(time(s.x + 22, s.y + 17, 13, 'start'));
      parts.push(statusIcons(s.x + s.width - 20, s.y + 12.5, 0.72, ink));
    } else if (cls === 'watch') {
      parts.push(time(s.x + s.width - 30, s.y + 22, 15, 'end', WATCH_TIME));
    }
  }
  // A watch keeps room at its foot but draws no home indicator.
  if (g.bars.bottom > 0 && cls !== 'watch') {
    const w =
      g.device === 'android' || g.device === 'android-tablet'
        ? 108
        : cls === 'tablet' || g.device === 'iphone-duo'
          ? 180
          : 134;
    const h = g.device === 'android' || g.device === 'android-tablet' ? 4 : 5;
    parts.push(
      `<rect x="${r2(s.x + s.width / 2 - w / 2)}" y="${r2(s.y + s.height - 8 - h)}" width="${w}" height="${h}" rx="${h / 2}" fill="${ink}" fill-opacity="0.88"/>`,
    );
  }
  return parts.join('');
}

// Signal, Wi-Fi and battery, ending at `right`, centred on `cy`, at `scale`.
function statusIcons(right: number, cy: number, scale: number, ink: string): string {
  // Drawn at 1x across 76 px, from x 0 to 76, centred on y 0.
  const bars = [4, 6.2, 8.4, 10.6]
    .map(
      (h, i) =>
        `<rect x="${i * 4.6}" y="${r2(5.3 - h)}" width="3.2" height="${h}" rx="0.9" fill="${ink}"/>`,
    )
    .join('');
  const wifi =
    `<path d="M23.5 -3.4A11 11 0 0 1 38.5 -3.4" fill="none" stroke="${ink}" stroke-width="2.1" stroke-linecap="round"/>` +
    `<path d="M26.3 0.1A6.6 6.6 0 0 1 35.7 0.1" fill="none" stroke="${ink}" stroke-width="2.1" stroke-linecap="round"/>` +
    `<circle cx="31" cy="3.9" r="1.7" fill="${ink}"/>`;
  const battery =
    `<rect x="47.5" y="-5.5" width="24" height="11.5" rx="3.4" fill="none" stroke="${ink}" stroke-opacity="0.4" stroke-width="1"/>` +
    `<rect x="49.5" y="-3.5" width="17" height="7.5" rx="1.8" fill="${ink}"/>` +
    `<path d="M73 -1.8V2.3A2 2 0 0 0 73 -1.8Z" fill="${ink}" fill-opacity="0.45"/>`;
  return `<g transform="translate(${r2(right - 76 * scale)} ${r2(cy)}) scale(${scale})">${bars}${wifi}${battery}</g>`;
}

/** The screen's outline at the page's top-left: what the page's content is clipped to. */
export function wireframeScreenPath(g: DeviceGeometry, ox: number, oy: number): string {
  return deviceScreenPath(g, ox, oy);
}
