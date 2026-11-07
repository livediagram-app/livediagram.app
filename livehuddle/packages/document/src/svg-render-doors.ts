// The export's Doors, Windows, Corridors and glass rooms (docs/specs/009-elements/room-builder.md "Door types",
// "Window", corridor.md "Export and agents", office.md "Glass walls"), drawn as the canvas draws them: a door's type shut
// or open (and its padlock when locked), a window with its light, a corridor's floor and walls, a room's glass walls.
// Its own module beside svg-render-faces.ts, which routes to it.

import {
  LOCKED_DOOR_SHADE,
  doorArt,
  doorLockCentre,
  doorPoseTransform,
  type DoorArtPart,
} from './door-art';
import { corridorPaths } from './piece-variants';
import { GLASS_WALL, glassRoomArt } from './glass-walls';
import { WINDOW_LIGHT, windowArt } from './window-art';
import type { CanvasSurface } from './colors';
import { FURNITURE_PANEL_STROKE, FURNITURE_RAIL_OPACITY, FURNITURE_RAIL_STROKE } from './seating';
import { ROOM_WALL } from './office';
import { r2, xmlEscape } from './svg-render-primitives';
import type { Face } from './svg-render-face-kit';

// A glass pane's wash of the stroke.
const GLASS_OPACITY = 0.16;

function geometry(p: DoorArtPart): string {
  switch (p.tag) {
    case 'rect':
      return `<rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}"${p.rx ? ` rx="${p.rx}"` : ''}`;
    case 'circle':
      return `<circle cx="${p.cx}" cy="${p.cy}" r="${p.r}"`;
    case 'path':
      return `<path d="${p.d}"`;
  }
}

/** A door part's paint as SVG attributes, `floor` and `line` already escaped. */
export function doorPaintAttrs(p: DoorArtPart, floor: string, line: string): string {
  switch (p.paint) {
    case 'floor':
      return `fill="${floor}"`;
    case 'jamb':
      return p.tag === 'path'
        ? `fill="none" stroke="${line}" stroke-width="${FURNITURE_PANEL_STROKE}"`
        : `fill="${floor}" stroke="${line}" stroke-width="${FURNITURE_PANEL_STROKE}"`;
    case 'leaf':
      return `fill="${floor}" stroke="${line}" stroke-width="${FURNITURE_PANEL_STROKE}"`;
    case 'glass':
      return `fill="${line}" fill-opacity="${GLASS_OPACITY}" stroke="${line}" stroke-width="${FURNITURE_RAIL_STROKE}"`;
    case 'pane':
      return `fill="${line}" fill-opacity="${GLASS_OPACITY}"`;
    case 'wing':
      return `fill="none" stroke="${line}" stroke-width="3" stroke-linecap="round"`;
    case 'swing':
      return `fill="none" stroke="${line}" stroke-width="${FURNITURE_RAIL_STROKE}" opacity="${FURNITURE_RAIL_OPACITY}" stroke-dasharray="4 4"`;
    case 'track':
      return `fill="none" stroke="${line}" stroke-width="1" opacity="${FURNITURE_RAIL_OPACITY}"`;
    case 'ink':
      return p.tag === 'path'
        ? `fill="none" stroke="${line}" stroke-width="1.5" stroke-linecap="round"`
        : `fill="${line}"`;
    case 'plate':
      return `fill="${floor}" stroke="${line}" stroke-width="1.5"`;
  }
}

/** A Door as the canvas draws it, in the pose it is in. */
export function doorSvg(el: Face, floor: string, stroke: string): string {
  const closed = el.doorClosed === true;
  const locked = el.locked === true;
  const f = xmlEscape(floor);
  const l = xmlEscape(stroke);
  const parts = doorArt(el.width, el.height, el.variant, locked).filter(
    (p) => !(closed && p.openOnly),
  );
  const body = parts
    .filter((p) => !p.lock)
    .map((p) => {
      const pose = p.motion
        ? doorPoseTransform(closed ? p.motion.shut : p.motion.open, p.motion.origin)
        : '';
      const at = pose ? ` transform="${pose}"` : '';
      const shade =
        locked && p.shades
          ? `${geometry(p)}${at} fill="${l}" opacity="${LOCKED_DOOR_SHADE}"/>`
          : '';
      return `${geometry(p)}${at} ${doorPaintAttrs(p, f, l)}/>${shade}`;
    })
    .join('');
  // The padlock stands upright: turned back by the rotation the whole door is drawn at.
  const lock = parts.filter((p) => p.lock);
  const c = doorLockCentre(el.width, el.height);
  const upright = el.rotation ? ` transform="rotate(${r2(-el.rotation)} ${c.x} ${c.y})"` : '';
  const padlock = lock.length
    ? `<g${upright}>${lock.map((p) => `${geometry(p)} ${doorPaintAttrs(p, f, l)}/>`).join('')}</g>`
    : '';
  return `<g transform="translate(${r2(el.x)} ${r2(el.y)})">${body}${padlock}</g>`;
}

/** A Corridor: its floor in the fill and its walls stroked as a room's, butt at the open ends. */
export function corridorSvg(el: Face, floor: string, stroke: string): string {
  const { floor: area, walls: runs } = corridorPaths(el.width, el.height, el.variant);
  const f = xmlEscape(floor);
  const l = xmlEscape(stroke);
  return (
    `<g transform="translate(${r2(el.x)} ${r2(el.y)})">` +
    `<path d="${area}" fill="${f}"/>` +
    `<path d="${runs}" fill="none" stroke="${l}" stroke-width="${ROOM_WALL + 2 * FURNITURE_PANEL_STROKE}" stroke-linejoin="miter"/>` +
    `<path d="${runs}" fill="none" stroke="${f}" stroke-width="${ROOM_WALL}" stroke-linejoin="miter"/>` +
    `</g>`
  );
}

/** A Window (room-builder.md "Window"): its light on the floor inside, then its frame, pane, mullion and sill. */
export function windowSvg(
  el: Face,
  floor: string,
  stroke: string,
  surface: CanvasSurface = 'light',
): string {
  const art = windowArt(el.width, el.height);
  const f = xmlEscape(floor);
  const l = xmlEscape(stroke);
  const light = WINDOW_LIGHT[surface === 'dark' ? 'dark' : 'light'];
  const id = `window-light-${xmlEscape(el.id)}`;
  const rect = (b: { x: number; y: number; w: number; h: number }, attrs: string) =>
    `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" ${attrs}/>`;
  // Turned onto its wall by the caller, as every element's rotation is.
  return (
    `<g transform="translate(${r2(el.x)} ${r2(el.y)})">` +
    `<defs><linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="0" y1="${art.fade.from}" x2="0" y2="${art.fade.to}">` +
    `<stop offset="0" stop-color="${light.colour}" stop-opacity="${light.opacity}"/>` +
    `<stop offset="1" stop-color="${light.colour}" stop-opacity="0"/></linearGradient></defs>` +
    `<path d="${art.light}" fill="url(#${id})"/>` +
    rect(art.frame, `fill="${f}" stroke="${l}" stroke-width="${FURNITURE_PANEL_STROKE}"`) +
    rect(
      art.pane,
      `fill="${l}" fill-opacity="${GLASS_OPACITY}" stroke="${l}" stroke-width="${FURNITURE_RAIL_STROKE}"`,
    ) +
    `<path d="${art.mullion}" stroke="${l}" stroke-width="${FURNITURE_RAIL_STROKE}"/>` +
    rect(art.sill, `fill="${f}" stroke="${l}" stroke-width="${FURNITURE_RAIL_STROKE}"`) +
    `</g>`
  );
}

/** A Room with glass walls (office.md "Glass walls"): its floor, the walls' see-through band, pane line and mullions, and a
 *  rectangle's back wall face with its glints. */
export function glassRoomSvg(
  el: Face,
  floor: string,
  stroke: string,
  surface: CanvasSurface = 'light',
): string {
  const art = glassRoomArt(el);
  const f = xmlEscape(floor);
  const l = xmlEscape(stroke);
  const glint = surface === 'dark' ? GLASS_WALL.glintDark : GLASS_WALL.glint;
  const faces = art.faces
    .map(
      (b) =>
        `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="2" fill="${l}" fill-opacity="${GLASS_WALL.face}" stroke="${l}" stroke-opacity="${GLASS_WALL.pane}" stroke-width="1"/>`,
    )
    .join('');
  return (
    `<g transform="translate(${r2(el.x)} ${r2(el.y)})">` +
    `<path d="${art.floor}" fill="${f}"/>` +
    faces +
    (art.glints
      ? `<path d="${art.glints}" fill="none" stroke="#ffffff" stroke-opacity="${glint}" stroke-width="2" stroke-linecap="round"/>`
      : '') +
    `<path d="${art.walls}" fill="none" stroke="${l}" stroke-opacity="${GLASS_WALL.band}" stroke-width="${ROOM_WALL + 2 * FURNITURE_PANEL_STROKE}" stroke-linejoin="miter"/>` +
    `<path d="${art.walls}" fill="none" stroke="${l}" stroke-opacity="${GLASS_WALL.pane}" stroke-width="1" stroke-linejoin="miter"/>` +
    (art.mullions
      ? `<path d="${art.mullions}" fill="none" stroke="${l}" stroke-opacity="${GLASS_WALL.mullion}" stroke-width="${GLASS_WALL.mullionWidth}"/>`
      : '') +
    `</g>`
  );
}
