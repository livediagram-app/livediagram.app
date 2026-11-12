// The drawn art behind the behaviour faces in the headless render (./svg-render-faces): the portal, the
// keycap edge, the fence, the Avatar Pad, the furniture, rooms, grass and any piece drawn to its own size.
// Each reproduces the table its canvas view draws, so a piece on the canvas and in an export match.
import { fenceParts, FENCE_RAIL_OPACITY } from '@livehuddle/avatar/fence';
import {
  AVATAR_PAD_ART,
  AVATAR_PAD_GLOW,
  AVATAR_PAD_VIEW,
  avatarPadPaint,
  type AvatarPadPaint,
} from './avatar-pad-art';
import {
  FURNITURE_ART,
  FURNITURE_FACE_SHADE,
  FURNITURE_GLINT,
  FURNITURE_LINE_STROKE,
  FURNITURE_PANEL_STROKE,
  FURNITURE_RAIL_OPACITY,
  FURNITURE_RAIL_STROKE,
  FURNITURE_SHADOW,
  FURNITURE_WEAVE,
  furnitureFrame,
  isSeatingShape,
  type FurniturePart,
} from './seating';
import {
  DEFAULT_ROOM_DOOR,
  ROOM_WALL,
  isGridOfficeShape,
  OFFICE_ART,
  roomParts,
  isLongTable,
  longTableArt,
} from './office';
import { chairSeatFill } from './shape-geometry';
import { outlinedRoomPaths } from './room-builder';
import { GRASS_BLADES, GRASS_TILES, grassEdgePath } from './office-garden';
import { r2, xmlEscape } from './svg-render-primitives';
import { borderOf } from './svg-render-border';
import type { Face } from './svg-render-face-kit';
import { pieceFacing } from './furniture-facing';

// PortalFace's art on its own 24x36 grid, kept in proportion as the canvas
// keeps it: the bloom, the mouth, the rim lit white at the crown, a hairline
// inside it and the motes. A portal with no target is the dim, dead ring.
export function portalArt(el: Face, stroke: string): string {
  const open = !!el.portalTarget;
  const id = xmlEscape(el.id);
  const s = xmlEscape(stroke);
  const o = (lit: number, dead: number) => (open ? lit : dead);
  return (
    `<svg x="${r2(el.x)}" y="${r2(el.y)}" width="${r2(el.width)}" height="${r2(el.height)}" viewBox="0 0 24 36" preserveAspectRatio="xMidYMid meet" overflow="visible">` +
    `<defs>` +
    `<radialGradient id="portal-bloom-${id}"><stop offset="55%" stop-color="${s}" stop-opacity="0"/><stop offset="84%" stop-color="${s}" stop-opacity="${o(0.45, 0.1)}"/><stop offset="100%" stop-color="${s}" stop-opacity="0"/></radialGradient>` +
    `<linearGradient id="portal-rim-${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#ffffff" stop-opacity="${o(0.95, 0.35)}"/><stop offset="35%" stop-color="${s}"/><stop offset="100%" stop-color="${s}" stop-opacity="${o(0.85, 0.5)}"/></linearGradient>` +
    `<radialGradient id="portal-mouth-${id}"><stop offset="0%" stop-color="#0b1020" stop-opacity="${o(0.92, 0.5)}"/><stop offset="70%" stop-color="#0b1020" stop-opacity="${o(0.72, 0.38)}"/><stop offset="100%" stop-color="${s}" stop-opacity="${o(0.75, 0.25)}"/></radialGradient>` +
    `</defs>` +
    `<ellipse cx="12" cy="18" rx="11.9" ry="17.9" fill="url(#portal-bloom-${id})"/>` +
    `<ellipse cx="12" cy="18" rx="7.4" ry="14.9" fill="url(#portal-mouth-${id})"/>` +
    `<ellipse cx="12" cy="18" rx="8.3" ry="15.8" fill="none" stroke="url(#portal-rim-${id})" stroke-width="2.4"/>` +
    `<ellipse cx="12" cy="18" rx="6.8" ry="14.1" fill="none" stroke="#ffffff" stroke-opacity="${o(0.32, 0.1)}" stroke-width="0.7"/>` +
    `<g opacity="${o(1, 0.35)}">` +
    `<path d="M6.7 12.6 A7.4 14.2 0 0 1 10.8 3.4" fill="none" stroke="#ffffff" stroke-opacity="0.5" stroke-width="0.9" stroke-linecap="round"/>` +
    `<circle cx="8.6" cy="11.5" r="0.7" fill="#ffffff" opacity="0.75"/>` +
    `<circle cx="15.4" cy="24.5" r="0.55" fill="#ffffff" opacity="0.55"/>` +
    `<circle cx="14.9" cy="14" r="0.4" fill="#ffffff" opacity="0.45"/>` +
    `</g></svg>`
  );
}

// paper-kit's keycapEdge, the moulding that makes a Mode Button a key: three
// inset shadows inside the border (a lit 1px along the top, a 2px shaded skirt
// along the bottom, a faint 1px ring), each drawn exactly as an inset shadow
// is: the box minus the box offset, clipped to the box. The 2px drop outside
// the box is left to the element's own shadow.
export function keycapEdge(el: Face, color: string): string {
  const b = borderOf(el);
  const x = el.x + b.width;
  const y = el.y + b.width;
  const w = el.width - b.width * 2;
  const h = el.height - b.width * 2;
  const rx = Math.max(0, b.radius - b.width);
  const box = (dx: number, dy: number, inset = 0) =>
    roundedPath(
      x + dx + inset,
      y + dy + inset,
      w - inset * 2,
      h - inset * 2,
      Math.max(0, rx - inset),
    );
  const id = `keycap-${xmlEscape(el.id)}`;
  const c = xmlEscape(color);
  const band = (inner: string, opacity: number) =>
    `<path d="${box(0, 0)} ${inner}" fill="${c}" fill-opacity="${opacity}" fill-rule="evenodd"/>`;
  return (
    `<clipPath id="${id}"><path d="${box(0, 0)}"/></clipPath>` +
    `<g clip-path="url(#${id})">` +
    band(box(0, 1), 0.28) +
    band(box(0, -2), 0.14) +
    band(box(0, 0, 1), 0.1) +
    `</g>`
  );
}

function roundedPath(x: number, y: number, w: number, h: number, r: number): string {
  const q = Math.min(r, w / 2, h / 2);
  return (
    `M ${r2(x + q)} ${r2(y)} H ${r2(x + w - q)} A ${r2(q)} ${r2(q)} 0 0 1 ${r2(x + w)} ${r2(y + q)}` +
    ` V ${r2(y + h - q)} A ${r2(q)} ${r2(q)} 0 0 1 ${r2(x + w - q)} ${r2(y + h)}` +
    ` H ${r2(x + q)} A ${r2(q)} ${r2(q)} 0 0 1 ${r2(x)} ${r2(y + h - q)}` +
    ` V ${r2(y + q)} A ${r2(q)} ${r2(q)} 0 0 1 ${r2(x + q)} ${r2(y)} Z`
  );
}

// A fence (docs/specs/009-elements/fence.md): rails then posts, from the table FenceView draws, in the
// element's own box (its rotation is the generic element rotation, applied by the caller).
export function fenceArt(el: Face, stroke: string): string {
  const line = xmlEscape(stroke);
  return fenceParts(el.width, el.height)
    .map(
      (p) =>
        `<rect x="${r2(el.x + p.x)}" y="${r2(el.y + p.y)}" width="${r2(p.width)}" height="${r2(p.height)}" rx="${r2(p.rx)}" fill="${line}"${p.role === 'rail' ? ` opacity="${FENCE_RAIL_OPACITY}"` : ''}/>`,
    )
    .join('');
}

// An Avatar Pad (docs/specs/009-elements/avatar-pad.md): the vector table AvatarPadView draws, in the theme's stroke
// and seat wash, fitted whole into the box and centred (`meet`), its ring lit (the shimmer and the arrival are the
// canvas's).
const padPaintAttrs = (p: AvatarPadPaint) =>
  `fill="${xmlEscape(p.fill)}"` +
  (p.stroke ? ` stroke="${xmlEscape(p.stroke)}" stroke-width="${p.strokeWidth}"` : '') +
  (p.opacity !== undefined ? ` opacity="${p.opacity}"` : '') +
  (p.strokeLinecap ? ` stroke-linecap="${p.strokeLinecap}"` : '');

export function avatarPadArt(el: Face, stroke: string): string {
  if (el.width <= 0 || el.height <= 0) return '';
  const glowId = `avatar-pad-glow-${xmlEscape(el.id)}`;
  const body = chairSeatFill(undefined, stroke);
  const g = xmlEscape(AVATAR_PAD_GLOW.color);
  const parts = AVATAR_PAD_ART.map((p) => {
    const paint = padPaintAttrs(avatarPadPaint(p.role, stroke, body, `url(#${glowId})`));
    return p.tag === 'ellipse'
      ? `<ellipse cx="${p.cx}" cy="${p.cy}" rx="${p.rx}" ry="${p.ry}" ${paint}/>`
      : `<path d="${p.d}" ${paint}/>`;
  }).join('');
  return (
    `<svg x="${r2(el.x)}" y="${r2(el.y)}" width="${r2(el.width)}" height="${r2(el.height)}" viewBox="0 0 ${AVATAR_PAD_VIEW.width} ${AVATAR_PAD_VIEW.height}" preserveAspectRatio="xMidYMid meet" overflow="visible">` +
    `<defs><radialGradient id="${glowId}"><stop offset="0%" stop-color="${g}" stop-opacity="${AVATAR_PAD_GLOW.innerOpacity}"/><stop offset="100%" stop-color="${g}" stop-opacity="0"/></radialGradient></defs>` +
    parts +
    `</svg>`
  );
}

// A piece of furniture (docs/specs/009-elements/furniture-facing.md "The camera"), from the FURNITURE_ART table
// FurnitureView draws: the drawing for its facing, mirrored for facing right, exactly as the canvas.
export function furnitureArt(el: Face, seat: string, stroke: string): string {
  const art = isLongTable(el)
    ? longTableArt(el.width, el.height, pieceFacing(el))
    : isSeatingShape(el.shape)
      ? FURNITURE_ART[el.shape]
      : isGridOfficeShape(el.shape)
        ? OFFICE_ART[el.shape]
        : null;
  if (!art) return '';
  // Every piece at its facing (docs/specs/009-elements/furniture-facing.md), as the canvas draws it.
  const frame = furnitureFrame(art, pieceFacing(el));
  const parts = frame.view.parts
    .map((p) => furniturePart(p, xmlEscape(seat), xmlEscape(stroke)))
    .join('');
  return (
    `<svg x="${r2(el.x)}" y="${r2(el.y)}" width="${r2(el.width)}" height="${r2(el.height)}" viewBox="${frame.viewBox}" preserveAspectRatio="xMidYMid meet" overflow="visible">` +
    (frame.transform ? `<g transform="${frame.transform}">${parts}</g>` : parts) +
    `</svg>`
  );
}

// A room (docs/specs/009-elements/office.md "Room"), drawn to its own size so its walls keep their thickness.
export function roomSvg(el: Face, floor: string, stroke: string): string {
  // A room drawn with the Room Builder (docs/specs/009-elements/room-builder.md): its floor polygon and its walls,
  // stroked along the outline as the canvas draws them.
  if (el.roomOutline && el.roomOutline.length >= 3) {
    const { floor: area, walls } = outlinedRoomPaths({ ...el, roomOutline: el.roomOutline });
    const f = xmlEscape(floor);
    const l = xmlEscape(stroke);
    return (
      `<g transform="translate(${r2(el.x)} ${r2(el.y)})">` +
      `<path d="${area}" fill="${f}"/>` +
      `<path d="${walls}" fill="none" stroke="${l}" stroke-width="${ROOM_WALL + 2 * FURNITURE_PANEL_STROKE}" stroke-linejoin="miter"/>` +
      `<path d="${walls}" fill="none" stroke="${f}" stroke-width="${ROOM_WALL}" stroke-linejoin="miter"/>` +
      `</g>`
    );
  }
  return sizedSvg(
    el,
    roomParts(el.width, el.height, el.roomDoor ?? DEFAULT_ROOM_DOOR),
    floor,
    stroke,
  );
}

// A piece drawn to its own size (a room, a stage), its parts in its own px from its top left.
// Grass (docs/specs/009-elements/office.md "Grass"): its lawn in the fill, then the tuft tiles as SVG patterns over it.
export function grassSvg(el: Face, floor: string): string {
  const d = grassEdgePath(el.width, el.height);
  if (!d) return '';
  const id = `grass-${xmlEscape(el.id)}`;
  const B = GRASS_BLADES;
  const blades = (path: string, color: string, opacity: number) =>
    `<path d="${path}" fill="none" stroke="${color}" stroke-opacity="${opacity}" stroke-width="${B.width}" stroke-linecap="round"/>`;
  const defs = GRASS_TILES.map(
    (t, i) =>
      `<pattern id="${id}-${i}" width="${t.size}" height="${t.size}" patternUnits="userSpaceOnUse">` +
      blades(t.shade, B.shade, B.shadeOpacity) +
      blades(t.light, B.light, B.lightOpacity) +
      `</pattern>`,
  ).join('');
  const layers = GRASS_TILES.map((_, i) => `<path d="${d}" fill="url(#${id}-${i})"/>`).join('');
  return (
    `<g transform="translate(${r2(el.x)} ${r2(el.y)})"><defs>${defs}</defs>` +
    `<path d="${d}" fill="${xmlEscape(floor)}" stroke="${B.shade}" stroke-opacity="${B.rimOpacity}" stroke-width="${B.rimWidth}"/>` +
    `${layers}</g>`
  );
}

export function sizedSvg(
  el: Face,
  parts: readonly FurniturePart[],
  floor: string,
  stroke: string,
): string {
  const drawn = parts.map((p) => furniturePart(p, xmlEscape(floor), xmlEscape(stroke))).join('');
  return `<g transform="translate(${r2(el.x)} ${r2(el.y)})">${drawn}</g>`;
}

function furniturePart(p: FurniturePart, seat: string, line: string): string {
  const paint = (() => {
    switch (p.role) {
      case 'shadow':
        return `fill="${FURNITURE_SHADOW.fill}" opacity="${FURNITURE_SHADOW.opacity}"`;
      case 'panel':
      case 'face':
        return `fill="${p.fill ? xmlEscape(p.fill) : seat}" stroke="${line}" stroke-width="${FURNITURE_PANEL_STROKE}"`;
      case 'floor':
        return `fill="${seat}"`;
      case 'mark':
        return `fill="${p.fill ? xmlEscape(p.fill) : line}"`;
      case 'line':
        return `fill="none" stroke="${line}" stroke-width="${FURNITURE_LINE_STROKE}" stroke-linecap="round"`;
      case 'rail':
        return `fill="none" stroke="${line}" stroke-width="${FURNITURE_RAIL_STROKE}" opacity="${FURNITURE_RAIL_OPACITY}" stroke-linecap="round"`;
      case 'screen':
        return `fill="${line}"`;
      case 'glint':
        return `fill="none" stroke="${FURNITURE_GLINT.stroke}" stroke-width="${FURNITURE_RAIL_STROKE}" opacity="${FURNITURE_GLINT.opacity}" stroke-linecap="round"`;
      // A rug's woven pattern (docs/specs/009-elements/office.md "Rug types").
      case 'tint':
        return `fill="${line}" opacity="${FURNITURE_WEAVE.tint}"`;
      case 'sheen':
        return `fill="${FURNITURE_GLINT.stroke}" opacity="${FURNITURE_WEAVE.sheen}"`;
      case 'dye':
        return `fill="${p.fill ? xmlEscape(p.fill) : line}" opacity="${FURNITURE_WEAVE.dye}"`;
    }
  })();
  // A face toward the room is the panel, shaded with its stroke colour.
  const shade = `fill="${line}" opacity="${FURNITURE_FACE_SHADE}"`;
  switch (p.tag) {
    case 'rect':
      return (
        `<rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" rx="${p.rx}" ${paint}/>` +
        (p.role === 'face'
          ? `<rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" rx="${p.rx}" ${shade}/>`
          : '')
      );
    case 'ellipse':
      return `<ellipse cx="${p.cx}" cy="${p.cy}" rx="${p.rx}" ry="${p.ry}" ${paint}/>`;
    case 'path':
      return `<path d="${p.d}" ${paint}/>`;
  }
}
