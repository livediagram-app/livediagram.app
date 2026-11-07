// The export's Doors and Corridors (docs/specs/009-elements/room-builder.md "Door types", corridor.md "Export and
// agents"), drawn as the canvas draws them: a door's type shut or open, a corridor's floor and walls. Its own module
// beside svg-render-faces.ts, which routes to it.

import { doorArt, doorPoseTransform, type DoorArtPart } from './door-art';
import { corridorPaths } from './piece-variants';
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
      return `fill="${line}"`;
  }
}

/** A Door as the canvas draws it, in the pose it is in. */
export function doorSvg(el: Face, floor: string, stroke: string): string {
  const closed = el.doorClosed === true;
  const f = xmlEscape(floor);
  const l = xmlEscape(stroke);
  const body = doorArt(el.width, el.height, el.variant)
    .filter((p) => !(closed && p.openOnly))
    .map((p) => {
      const pose = p.motion
        ? doorPoseTransform(closed ? p.motion.shut : p.motion.open, p.motion.origin)
        : '';
      const at = pose ? ` transform="${pose}"` : '';
      return `${geometry(p)}${at} ${doorPaintAttrs(p, f, l)}/>`;
    })
    .join('');
  return `<g transform="translate(${r2(el.x)} ${r2(el.y)})">${body}</g>`;
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
