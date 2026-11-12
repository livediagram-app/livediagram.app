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

import { ROOM_FLOOR, RUG_FILL, STAGE_FLOOR, stageParts } from './office';
import { chairSeatFill } from './shape-geometry';
import { corridorSvg, doorSvg, glassRoomSvg, windowSvg } from './svg-render-doors';
import { isGlassRoom } from './glass-walls';
import { rugDrawnToSize, rugParts } from './rug-art';
import {
  GARDEN_PATH_FILL,
  GARDEN_TONES,
  GRASS_FILL,
  gardenFenceParts,
  gardenPathParts,
} from './office-garden';
import { POND_FILL, pondParts } from './office-social';
import { POOL_FILL, swimmingPoolParts } from './office-venue';
import { r2, xmlEscape } from './svg-render-primitives';
import { roomSignSvg, screenSvg } from './svg-render-meeting';
import { timerPieceSvg } from './svg-render-timers';
import { DEFAULT_BUTTON_MODE, SELECTION_MODE_LABEL } from './selection-mode';
import { text, type Face } from './svg-render-face-kit';
import { glyphStrokePx, iconPrimsMarkup, strokeUnits } from '@liveworkspace/icons';
import { MODE_GLYPHS } from './mode-glyphs';
import type { CanvasSurface } from './colors';
import {
  avatarPadArt,
  fenceArt,
  furnitureArt,
  grassSvg,
  keycapEdge,
  portalArt,
  roomSvg,
  sizedSvg,
} from './svg-render-office-art';

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
