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

// The Room Sign as the canvas draws it (RoomSignView), reading Free: a real sign, the same on every paper.
export function roomSignSvg(el: Face): string {
  const a = ROOM_SIGN_ART;
  const t = a.tones;
  const p = a.plate;
  const id = `room-sign-${xmlEscape(el.id)}`;
  const tone = ROOM_SIGN_TONES.free;
  const body =
    `<defs><linearGradient id="${id}-f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${t.frameLit}"/>` +
    `<stop offset="1" stop-color="${t.frame}"/></linearGradient>` +
    `<linearGradient id="${id}-p" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${t.plate}"/>` +
    `<stop offset="1" stop-color="${t.plateShade}"/></linearGradient>` +
    `<clipPath id="${id}-c"><rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" rx="${p.rx}"/></clipPath></defs>` +
    `<rect y="2" width="${a.plaque.w}" height="${a.plaque.h}" rx="${a.plaque.rx}" fill="#0b1220" opacity="0.18"/>` +
    `<rect x="0.5" y="0.5" width="${a.plaque.w - 1}" height="${a.plaque.h - 1}" rx="${a.plaque.rx}" fill="url(#${id}-f)" stroke="${t.frameEdge}"/>` +
    `<rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" rx="${p.rx}" fill="url(#${id}-p)" stroke="${t.plateEdge}" stroke-width="0.75"/>` +
    `<rect x="${a.stripe.x}" y="${p.y}" width="${a.stripe.w}" height="${p.h}" fill="${tone}" clip-path="url(#${id}-c)"/>` +
    a.screws
      .map(
        (c) =>
          `<circle cx="${c.cx}" cy="${c.cy}" r="1.8" fill="${t.screw}" stroke="${t.screwEdge}" stroke-width="0.5"/>`,
      )
      .join('') +
    text(a.name.x, a.name.y, 'Room', { size: a.name.size, weight: 600, color: t.ink }) +
    `<circle cx="${a.status.dotX}" cy="${a.status.y - 4}" r="6" fill="${tone}" opacity="0.25"/>` +
    `<circle cx="${a.status.dotX}" cy="${a.status.y - 4}" r="3.5" fill="${tone}"/>` +
    text(a.status.dotX + 9, a.status.y, 'Free', {
      size: a.status.size,
      weight: 500,
      color: t.soft,
    });
  return scaled(el, a.plaque.w, a.plaque.h, body);
}
