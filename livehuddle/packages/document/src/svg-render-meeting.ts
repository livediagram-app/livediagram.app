// The meeting pieces in an export (docs/specs/009-elements/screen-and-room-sign.md "Export"): a Screen's idle face (or
// its video's named card) and a Room Sign's plaque reading Free. An export is a still picture of one element, with
// nobody in it, so neither shows a share or a count. The drawings are the canvas's (SCREEN_ART, ROOM_SIGN_ART).

import {
  ROOM_SIGN_ART,
  ROOM_SIGN_TONES,
  SCREEN_ART,
  SCREEN_IDLE_TEXT,
  screenVideoTarget,
} from './meeting-pieces';
import { r2, xmlEscape } from './svg-render-primitives';
import { text, type Face } from './svg-render-face-kit';
import type { CanvasSurface } from './colors';

// The piece's design box scaled onto the element's box.
function scaled(el: Face, w: number, h: number, body: string): string {
  return `<g transform="translate(${r2(el.x)} ${r2(el.y)}) scale(${r2(el.width / w)} ${r2(el.height / h)})">${body}</g>`;
}

export function screenSvg(el: Face): string {
  const { bezel: b, panel: p, light: l, shadow: s, tones: t } = SCREEN_ART;
  const video = screenVideoTarget(el.screenUrl);
  const words = video ? video.label : SCREEN_IDLE_TEXT;
  const body =
    `<rect x="${s.dx}" y="${s.dy}" width="${b.w}" height="${b.h}" rx="${b.rx}" fill="#000" opacity="${s.opacity}"/>` +
    `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="${b.rx}" fill="${t.bezel}" stroke="${t.bezelEdge}"/>` +
    `<rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" rx="${p.rx}" fill="${t.panel}"/>` +
    `<circle cx="${l.cx}" cy="${l.cy}" r="${l.r}" fill="${video ? '#4ade80' : t.bezelEdge}"/>` +
    text(p.x + p.w / 2, p.y + p.h / 2 + 4, words, { size: 11, color: t.ink, anchor: 'middle' });
  return scaled(el, b.w, b.h, body);
}

// A plaque is a real sign, so the export draws the light one on every paper.
export function roomSignSvg(el: Face, surface?: CanvasSurface): string {
  const a = ROOM_SIGN_ART;
  // The plaque the canvas shows on this paper (RoomSignView), so a dark export has no white card on it.
  const t = surface === 'dark' ? a.tones.dark : a.tones.light;
  const clip = `room-sign-${xmlEscape(el.id)}`;
  const body =
    `<clipPath id="${clip}"><rect width="${a.plaque.w}" height="${a.plaque.h}" rx="${a.plaque.rx}"/></clipPath>` +
    `<g clip-path="url(#${clip})"><rect width="${a.plaque.w}" height="${a.plaque.h}" fill="${t.plaque}"/>` +
    `<rect width="${a.stripe}" height="${a.plaque.h}" fill="${ROOM_SIGN_TONES.free}"/></g>` +
    `<rect x="0.5" y="0.5" width="${a.plaque.w - 1}" height="${a.plaque.h - 1}" rx="${a.plaque.rx}" fill="none" stroke="${t.edge}"/>` +
    a.screws.map((c) => `<circle cx="${c.cx}" cy="${c.cy}" r="2" fill="${t.screw}"/>`).join('') +
    text(a.name.x, a.name.y, 'Room', { size: a.name.size, weight: 600, color: t.ink }) +
    `<circle cx="${a.status.dotX}" cy="${a.status.y - 4}" r="4" fill="${ROOM_SIGN_TONES.free}"/>` +
    text(a.status.dotX + 9, a.status.y, 'Free', {
      size: a.status.size,
      weight: 500,
      color: t.soft,
    });
  return scaled(el, a.plaque.w, a.plaque.h, body);
}
