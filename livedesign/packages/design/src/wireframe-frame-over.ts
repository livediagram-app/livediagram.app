// What is drawn over a wireframe page's screen content (docs/specs/007-editor/wireframe-pages.md): the
// camera that sits in the screen (the Dynamic Island, the punch hole, a Duo's fold) and the status bar
// and home indicator. Re-exported from wireframe-device-svg.ts.
import { r2 } from './svg-render-primitives';
import {
  ANDROID,
  IPHONE,
  WIREFRAME_DEVICES,
  roundedRectPath,
  type DeviceGeometry,
  type WireframeFrameLook,
} from './wireframe-device';
import {
  BAR_FONT,
  circleD,
  framePaint,
  lineArt,
  placeTransform,
  rrect,
  shift,
  type Paint,
  type Rect,
  type WireframeFrameTheme,
} from './wireframe-frame-paint';

const STATUS_TIME = '9:41';
const WATCH_TIME = '10:09';

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
