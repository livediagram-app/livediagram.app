// A wireframe page's device frame as SVG (docs/specs/007-editor/wireframe-pages.md): the frame
// UNDER the screen (body, bezel, buttons, a camera in the bezel, a laptop's base, a monitor's
// stand, a browser's toolbar, a watch's case and band) and what is drawn OVER the screen's
// content (the Dynamic Island or punch-hole camera, the status bar, the home indicator). One
// markup for the canvas (inlined into its sheet and overlay), every export and the agents'
// previews, so they draw the same frame. Pure strings in canvas coordinates; no DOM.
import { r2, xmlEscape } from './svg-render-primitives';
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
  deviceScreenPath,
  roundedRectPath,
  wireframeAddress,
  type DeviceGeometry,
  type WireframeFrameLook,
} from './wireframe-device';
import {
  BAR_FONT,
  body,
  circleD,
  framePaint,
  lineArt,
  OUTLINE_WIDTH,
  part,
  placeTransform,
  rrect,
  screenEdge,
  shift,
  type Paint,
  type WireframeFrameTheme,
} from './wireframe-frame-paint';

// A frame's paint and theme, and what is drawn over the screen, live beside this file; re-exported so
// callers' imports stay as they were.
export { wireframeFrameTheme, type WireframeFrameTheme } from './wireframe-frame-paint';
export { wireframeFrameOverSvg } from './wireframe-frame-over';

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

/** The screen's outline at the page's top-left: what the page's content is clipped to. */
export function wireframeScreenPath(g: DeviceGeometry, ox: number, oy: number): string {
  return deviceScreenPath(g, ox, oy);
}
