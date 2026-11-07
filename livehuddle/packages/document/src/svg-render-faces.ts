// Behaviour faces in the headless render (docs/specs/009-elements/mode-button.md to /137): the buttons,
// the portal, the seating and the office pieces. They draw with svg-render-face-kit.ts.
//
// These kinds all once exported as the SAME thing: a rounded box with the
// kind's name centred in it. What they draw here is each face's structure and
// marks in its real colours and at its real scale; what they leave out is
// motion and the pressed / live states of controls, which cannot be pressed
// in a still image (docs/specs/020-import-export/export-fidelity.md).
//
// Layout is in DESIGN units and then scaled, exactly as CollabScale does on
// the canvas: a card is composed at its kind's default size and scaled to the
// box, so a big one has bigger type rather than more padding.

import { fenceParts, FENCE_RAIL_OPACITY } from '@liveworkspace/avatar/fence';
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
  ROOM_FLOOR,
  roomParts,
  RUG_FILL,
  STAGE_FLOOR,
  stageParts,
  isLongTable,
  longTableArt,
} from './office';
import { chairSeatFill } from './shape-geometry';
import { outlinedRoomPaths } from './room-builder';
import { corridorSvg, doorSvg, glassRoomSvg, windowSvg } from './svg-render-doors';
import { isGlassRoom } from './glass-walls';
import { rugDrawnToSize, rugParts } from './rug-art';
import {
  GARDEN_PATH_FILL,
  GARDEN_TONES,
  GRASS_BLADES,
  GRASS_FILL,
  GRASS_TILES,
  gardenFenceParts,
  gardenPathParts,
  grassEdgePath,
} from './office-garden';
import { POND_FILL, pondParts } from './office-social';
import { POOL_FILL, swimmingPoolParts } from './office-venue';
import { r2, xmlEscape } from './svg-render-primitives';
import { roomSignSvg, screenSvg } from './svg-render-meeting';
import { timerPieceSvg } from './svg-render-timers';
import { DEFAULT_BUTTON_MODE, SELECTION_MODE_LABEL } from './selection-mode';
import { borderOf } from './svg-render-border';
import { text, type Face } from './svg-render-face-kit';
import { pieceFacing } from './furniture-facing';
import { glyphStrokePx, iconPrimsMarkup, strokeUnits } from '@liveworkspace/icons';
import { MODE_GLYPHS } from './mode-glyphs';
import type { CanvasSurface } from './colors';

// The canvas draws a mode glyph at the palette's 14px weight and scales the
// SVG to 22px on the button face, with non-scaling strokes, so its lines stay
// at the palette's on-screen weight. The export reproduces that: the same
// prims at 22px, every stroke converted from on-screen px to the glyph's units.
const MODE_GLYPH_PX = 22;
const MODE_GLYPH_SOURCE_PX = 14;
function modeGlyph(mode: string, cx: number, cy: number, color: string): string {
  const g = MODE_GLYPHS[mode];
  if (!g) return '';
  const toUnits = (px: number) => strokeUnits(px, MODE_GLYPH_PX, g.units);
  const prims = g.prims.map((p) => (p.sw !== undefined ? { ...p, sw: toUnits(p.sw) } : p));
  const half = MODE_GLYPH_PX / 2;
  return (
    `<svg x="${r2(cx - half)}" y="${r2(cy - half)}" width="${MODE_GLYPH_PX}" height="${MODE_GLYPH_PX}"` +
    ` viewBox="0 0 ${g.units} ${g.units}" color="${xmlEscape(color)}" fill="none" stroke="${xmlEscape(color)}"` +
    ` stroke-width="${r2(toUnits(glyphStrokePx(MODE_GLYPH_SOURCE_PX)))}" stroke-linecap="round" stroke-linejoin="round">` +
    iconPrimsMarkup(prims) +
    `</svg>`
  );
}

/** The Behaviour kinds this module draws a face for, so the caller knows not
 *  to print the generic centred label over the top of one. */
export const BEHAVIOUR_FACE_SHAPES = new Set<string>([
  'mode-button',
  'portal',
  'chair',
  'desk',
  'sofa',
  'fence',
  // Avatar Pad (docs/specs/009-elements/avatar-pad.md).
  'avatar-pad',
  // The virtual office (docs/specs/009-elements/office.md).
  'room',
  'corridor',
  'meeting-table',
  'plant',
  'bookshelf',
  'water-cooler',
  'coffee-machine',
  'rug',
  'stage',
  'office-pod',
  'bar',
  'bar-stool',
  'drinks-cabinet',
  'drinks-fridge',
  'outdoor-plant',
  'tree',
  'garden-path',
  'grass',
  'garden-fence',
  // The social pieces (docs/specs/009-elements/social-pieces.md).
  'notice-board',
  'world-clock',
  'jukebox',
  'ping-pong-table',
  'arcade-machine',
  'fireplace',
  'campfire',
  'bench',
  'picnic-table',
  'hammock',
  'garden-umbrella',
  'fountain',
  'pond',
  'pool-table',
  'foosball-table',
  'dartboard',
  'vending-machine',
  'bean-bag',
  'reading-nook',
  'printer',
  'copier',
  'lockers',
  'coat-rack',
  'umbrella-stand',
  'kitchen-counter',
  'kitchen-sink',
  'fridge',
  'microwave',
  'kettle',
  'toilet-cubicle',
  'washbasin',
  'hand-dryer',
  'pillar',
  'column',
  'car-park',
  'bike-rack',
  'swimming-pool',
  'stage-curtains',
  'podium',
  // The workday pieces (docs/specs/009-elements/workday-pieces.md).
  'nap-pod',
  'treadmill',
  'weight-bench',
  'phone-booth',
  'standing-desk',
  'hot-desk',
  'pet-bed',
  'reception-desk',
  // The team pieces (docs/specs/009-elements/team-pieces.md).
  'calendar-wall',
  'suggestion-box',
  'signpost',
  'photo-wall',
  'door',
  'window',
  'directory',
  'elevator',
  'stairs',
  // The meeting pieces (docs/specs/009-elements/screen-and-room-sign.md).
  'screen',
  'room-sign',
  // The Timer and Stopwatch (docs/specs/009-elements/timer-and-stopwatch.md).
  'timer',
  'stopwatch',
  'focus-button',
]);

// ── Behaviour elements (docs/specs/009-elements/mode-button.md to /107, /135, /136) ───────────────────

export function svgBehaviourFace(
  el: Face,
  label: string,
  color: string,
  stroke: string,
  // The element's resolved fill, for the floor pieces (a rug, a room, a stage) drawn in it.
  fill?: string,
  // The paper it lands on, for the pieces with a dark look of their own (the Room Sign's plaque).
  surface?: CanvasSurface,
): string | null {
  const cx = el.x + el.width / 2;
  const cy = el.y + el.height / 2;
  const title = label.trim();
  switch (el.shape) {
    case 'focus-button': {
      // Bring Focus (docs/specs/012-collaboration/bring-focus.md): the chip and its target, over the label. The
      // press states are the one thing not reproduced, for the reason every
      // other control here drops them: nothing in a still image can be
      // hovered or held.
      const gy = cy - 12;
      return (
        `<circle cx="${r2(cx)}" cy="${r2(gy)}" r="18" fill="${xmlEscape(color)}" opacity="0.07"/>` +
        `<circle cx="${r2(cx)}" cy="${r2(gy)}" r="18" fill="none" stroke="${xmlEscape(color)}" stroke-width="1" opacity="0.2"/>` +
        // The canvas glyph's own 24-unit geometry, dropped in at its size
        // rather than re-derived: a reticle redrawn by hand in a second
        // renderer is a reticle that drifts.
        `<svg x="${r2(cx - 11)}" y="${r2(gy - 11)}" width="22" height="22" viewBox="0 0 24 24" overflow="visible">` +
        `<circle cx="12" cy="12" r="7.5" fill="none" stroke="${xmlEscape(color)}" stroke-width="1.8"/>` +
        `<circle cx="12" cy="12" r="2.2" fill="${xmlEscape(color)}"/>` +
        `<path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3" fill="none" stroke="${xmlEscape(color)}" stroke-width="1.8" stroke-linecap="round"/>` +
        `</svg>` +
        text(cx, cy + 24, title || 'Bring Focus', {
          size: 12,
          weight: 600,
          color,
          anchor: 'middle',
        })
      );
    }
    case 'mode-button': {
      // ModeButtonFace: the mode's glyph in a translucent chip over the label,
      // or, with no label, a "Switch to" kicker over the mode's name. The
      // glyph is the SAME drawing the canvas uses (MODE_GLYPHS).
      const derived = !title;
      const chipY = cy - (derived ? 16 : 11.5);
      const mode = SELECTION_MODE_LABEL[el.mode ?? DEFAULT_BUTTON_MODE];
      return (
        keycapEdge(el, color) +
        `<circle cx="${r2(cx)}" cy="${r2(chipY)}" r="17.5" fill="${xmlEscape(color)}" fill-opacity="0.055" stroke="${xmlEscape(color)}" stroke-opacity="0.07"/>` +
        modeGlyph(el.mode ?? DEFAULT_BUTTON_MODE, cx, chipY, color) +
        (derived
          ? text(cx, cy + 18, 'Switch to', {
              size: 9,
              weight: 500,
              color,
              anchor: 'middle',
              opacity: 0.7,
              uppercase: true,
            }) + text(cx, cy + 32, mode, { size: 13, weight: 600, color, anchor: 'middle' })
          : text(cx, cy + 27, title, { size: 12, weight: 600, color, anchor: 'middle' }))
      );
    }
    case 'chair':
    case 'desk':
    case 'sofa':
    case 'meeting-table':
    case 'plant':
    case 'bookshelf':
    case 'water-cooler':
    case 'coffee-machine':
    case 'office-pod':
    case 'bar':
    case 'bar-stool':
    case 'drinks-cabinet':
    case 'drinks-fridge':
    case 'outdoor-plant':
    case 'tree':
    case 'directory':
    case 'elevator':
    case 'stairs':
    case 'notice-board':
    case 'world-clock':
    case 'jukebox':
    case 'ping-pong-table':
    case 'arcade-machine':
    case 'fireplace':
    case 'campfire':
    case 'bench':
    case 'picnic-table':
    case 'hammock':
    case 'garden-umbrella':
    case 'fountain':
    case 'pool-table':
    case 'foosball-table':
    case 'dartboard':
    case 'vending-machine':
    case 'bean-bag':
    case 'reading-nook':
    case 'printer':
    case 'copier':
    case 'lockers':
    case 'coat-rack':
    case 'umbrella-stand':
    case 'kitchen-counter':
    case 'kitchen-sink':
    case 'fridge':
    case 'microwave':
    case 'kettle':
    case 'toilet-cubicle':
    case 'washbasin':
    case 'hand-dryer':
    case 'pillar':
    case 'column':
    case 'car-park':
    case 'bike-rack':
    case 'stage-curtains':
    case 'podium':
    case 'nap-pod':
    case 'treadmill':
    case 'weight-bench':
    case 'phone-booth':
    case 'standing-desk':
    case 'hot-desk':
    case 'pet-bed':
    case 'reception-desk':
    case 'calendar-wall':
    case 'suggestion-box':
    case 'signpost':
    case 'photo-wall':
      return furnitureArt(el, chairSeatFill(el.fillColor, stroke), stroke);
    // A pond (docs/specs/009-elements/social-pieces.md "Pond"): its water in the fill, drawn to its size.
    case 'pond':
      return sizedSvg(
        el,
        pondParts(el.width, el.height),
        fill ?? el.fillColor ?? POND_FILL,
        stroke,
      );
    // A swimming pool (docs/specs/009-elements/venue-pieces.md "Swimming Pool"): its water in the fill, drawn to its size.
    case 'swimming-pool':
      return sizedSvg(
        el,
        swimmingPoolParts(el.width, el.height),
        fill ?? el.fillColor ?? POOL_FILL,
        stroke,
      );
    // A garden path and grass are floor like a rug, a garden fence its pickets (docs/specs/009-elements/office.md).
    case 'garden-path':
      return sizedSvg(
        el,
        gardenPathParts(el.width, el.height),
        fill ?? el.fillColor ?? GARDEN_PATH_FILL,
        stroke,
      );
    case 'grass':
      return grassSvg(el, fill ?? el.fillColor ?? GRASS_FILL);
    case 'garden-fence':
      return sizedSvg(el, gardenFenceParts(el.width, el.height), GARDEN_TONES.picket, stroke);
    // A rug and a room are floor: their own fill, not the seats' wash (docs/specs/009-elements/office.md), resolved
    // for the paper as the canvas resolves it (deep on a dark tab).
    case 'rug':
      // A patterned rug (office.md "Rug types") is drawn to its size; the Oval keeps its scaled drawing.
      return rugDrawnToSize(el)
        ? sizedSvg(
            el,
            rugParts(el.width, el.height, el.variant),
            fill ?? el.fillColor ?? RUG_FILL,
            stroke,
          )
        : furnitureArt(el, fill ?? el.fillColor ?? RUG_FILL, stroke);
    // A Corridor (docs/specs/009-elements/corridor.md): its floor and walls.
    case 'corridor':
      return corridorSvg(el, fill ?? el.fillColor ?? ROOM_FLOOR, stroke);
    case 'room':
      // A glass-walled room (office.md "Glass walls") draws its walls as panes.
      return isGlassRoom(el)
        ? glassRoomSvg(el, fill ?? el.fillColor ?? ROOM_FLOOR, stroke, surface)
        : roomSvg(el, fill ?? el.fillColor ?? ROOM_FLOOR, stroke);
    case 'door':
      return doorSvg(el, fill ?? el.fillColor ?? ROOM_FLOOR, stroke);
    // A Window (room-builder.md "Window"): its frame and pane in the wall, its light inside.
    case 'window':
      return windowSvg(el, fill ?? el.fillColor ?? ROOM_FLOOR, stroke, surface);
    case 'stage':
      return sizedSvg(
        el,
        stageParts(el.width, el.height),
        fill ?? el.fillColor ?? STAGE_FLOOR,
        stroke,
      );
    // The Screen and the Room Sign (docs/specs/009-elements/screen-and-room-sign.md "Export").
    case 'screen':
      return screenSvg(el);
    case 'room-sign':
      return roomSignSvg(el, surface);
    // The Timer and Stopwatch (docs/specs/009-elements/timer-and-stopwatch.md "Export"): the time at the export.
    case 'timer':
    case 'stopwatch':
      return timerPieceSvg(el, Date.now());
    case 'fence':
      return fenceArt(el, stroke);
    case 'avatar-pad':
      return avatarPadArt(el, stroke);
    case 'portal':
      return portalArt(el, stroke);
    default:
      return null;
  }
}

/**
 * A face wrapped in the element's typeface (docs/specs/004-interface-design/fonts.md).
 *
 * One group rather than an attribute on each of the twenty-odd text marks
 * inside: SVG text inherits `font-family`, so the wrapper is both shorter and
 * impossible to forget on a new mark.
 */
export function svgFace(body: string, fontFamily?: string): string {
  if (!body) return '';
  return `<g font-family="${xmlEscape(fontFamily ?? 'system-ui, sans-serif')}">${body}</g>`;
}

// PortalFace's art on its own 24x36 grid, kept in proportion as the canvas
// keeps it: the bloom, the mouth, the rim lit white at the crown, a hairline
// inside it and the motes. A portal with no target is the dim, dead ring.
function portalArt(el: Face, stroke: string): string {
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
function keycapEdge(el: Face, color: string): string {
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
function fenceArt(el: Face, stroke: string): string {
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

function avatarPadArt(el: Face, stroke: string): string {
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
function furnitureArt(el: Face, seat: string, stroke: string): string {
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
function roomSvg(el: Face, floor: string, stroke: string): string {
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
function grassSvg(el: Face, floor: string): string {
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

function sizedSvg(
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
