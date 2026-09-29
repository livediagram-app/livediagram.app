// Behaviour faces in the headless render (docs/specs/009-elements/mode-button.md to /137): the buttons,
// the reveal cover, the picker, the reaction pad, the comment and action
// panels, the portal, the chair. The Collaborate panels have their own module
// (svg-render-collab-faces.ts); both draw with svg-render-face-kit.ts.
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

import { DEFAULT_CHAIR_FACING } from './collab-shapes';
import { CHAIR_FACING_ROTATION, CHAIR_GEOMETRY, chairSeatFill } from './shape-geometry';
import { REACTION_DEFAULT, REACTION_EMOJI, REACTION_HUES } from './data-shapes';
import { r2, xmlEscape } from './svg-render-primitives';
import { formatTimerClock } from './session';
import { DEFAULT_BUTTON_MODE, SELECTION_MODE_LABEL } from './selection-mode';
import { borderOf } from './svg-render-border';
import { REVEAL_COVER_BASE, type CanvasSurface } from './colors';
import { collabAccent, glow, pill, text, type Face } from './svg-render-face-kit';
import { svgActionPanel, svgCommentPanel } from './svg-render-panel-faces';
import { glyphStrokePx, iconPrimsMarkup, strokeUnits } from '@livediagram/icons';
import { MODE_GLYPHS } from '@livediagram/icons/mode-glyphs';

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
  'session-button',
  'reveal',
  'picker',
  'reaction-pad',
  'comment-pin',
  'action-card',
  'portal',
  'chair',
  'focus-button',
]);

// ── Behaviour elements (docs/specs/009-elements/mode-button.md to /107, /135, /136) ───────────────────

export function svgBehaviourFace(
  el: Face,
  label: string,
  color: string,
  stroke: string,
  // The paper under the element, for the faces whose base follows it (the
  // Reveal cover), exactly as the canvas face reads it.
  surface: CanvasSurface = 'light',
  // The card's resolved fill, for the Comment and Action panels' accent ink.
  fill?: string,
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
    case 'session-button':
      // A timer reads as the canvas's idle dial (SessionTimerFace): ticks
      // along the top edge, the kicker and the configured length. The Start
      // control is editor chrome and stays out of the image.
      if (el.session?.tool === 'timer') return timerFace(el, cx, cy, color);
      // The other tools: a stopwatch over the tool's name.
      return (
        `<circle cx="${r2(cx)}" cy="${r2(cy - 12)}" r="10" fill="none" stroke="${xmlEscape(color)}" stroke-width="1.5"/>` +
        `<path d="M ${r2(cx)} ${r2(cy - 18)} L ${r2(cx)} ${r2(cy - 12)} L ${r2(cx + 5)} ${r2(cy - 9)}" fill="none" stroke="${xmlEscape(color)}" stroke-width="1.5" stroke-linecap="round"/>` +
        text(cx, cy + 16, title || 'Session', { size: 12, weight: 600, color, anchor: 'middle' })
      );
    case 'reveal':
      return el.revealed === true ? '' : revealCover(el, cx, cy, title, color, stroke, surface);
    case 'picker':
      return picker(el, cx, cy, title, color, surface);
    case 'reaction-pad':
      return reactionPad(el, cx, cy, title, color);
    case 'chair': {
      // The chair itself (docs/specs/009-elements/chair.md), from the shared table the canvas's
      // ChairView draws (shape-geometry.ts): backrest, slat, seat, legs and
      // stretcher, plus the contact shadow that sits it on the canvas rather
      // than floating it over. Turned whole for its facing, about the box
      // centre, exactly as the canvas rotates its svg.
      const g = CHAIR_GEOMETRY;
      const seat = xmlEscape(chairSeatFill(el.fillColor, stroke));
      const line = xmlEscape(stroke);
      const panel = (p: { x: number; y: number; width: number; height: number; rx: number }) =>
        `<rect x="${p.x}" y="${p.y}" width="${p.width}" height="${p.height}" rx="${p.rx}" fill="${seat}" stroke="${line}" stroke-width="${g.panelStrokeWidth}"/>`;
      const rail = (d: string) =>
        `<path d="${d}" stroke="${line}" stroke-width="${g.railStrokeWidth}" opacity="${g.railOpacity}" fill="none"/>`;
      const chair =
        `<svg x="${r2(el.x)}" y="${r2(el.y)}" width="${r2(el.width)}" height="${r2(el.height)}" viewBox="${g.viewBox}" preserveAspectRatio="xMidYMid meet" overflow="visible">` +
        `<ellipse cx="${g.shadow.cx}" cy="${g.shadow.cy}" rx="${g.shadow.rx}" ry="${g.shadow.ry}" fill="${g.shadow.fill}" opacity="${g.shadow.opacity}"/>` +
        panel(g.back) +
        rail(g.slat) +
        panel(g.seat) +
        `<path d="${g.legs}" stroke="${line}" stroke-width="${g.legStrokeWidth}" stroke-linecap="round" fill="none"/>` +
        rail(g.stretcher) +
        `</svg>`;
      const turn = CHAIR_FACING_ROTATION[el.chairFacing ?? DEFAULT_CHAIR_FACING];
      return turn
        ? `<g transform="rotate(${turn} ${r2(el.x + el.width / 2)} ${r2(el.y + el.height / 2)})">${chair}</g>`
        : chair;
    }
    case 'comment-pin':
      // docs/specs/012-collaboration/comment-pin.md "The look": the thread as bubbles, the composer.
      return svgCommentPanel(el, title, color, collabAccent(stroke, fill ?? '#ffffff', color));
    case 'action-card':
      // docs/specs/012-collaboration/action-panel.md "The card": a row per action, the Add Action bar.
      return svgActionPanel(el, title, color, collabAccent(stroke, fill ?? '#ffffff', color));
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

// SessionTimerFace idle: DialTicks (24 ticks, every sixth a taller quarter
// mark) along the top edge, then "TIMER" and the clock side by side.
const DIAL_TICKS = 24;
function timerFace(el: Face, cx: number, cy: number, color: string): string {
  const ticks = Array.from({ length: DIAL_TICKS }, (_, i) => {
    const quarter = i % 6 === 0;
    const x = el.x + 0.5 + (i / (DIAL_TICKS - 1)) * (el.width - 1);
    return `<rect x="${r2(x - 0.5)}" y="${r2(el.y)}" width="1" height="${quarter ? 7 : 4}" fill="${xmlEscape(color)}" fill-opacity="${quarter ? 0.3 : 0.16}"/>`;
  }).join('');
  const clock = formatTimerClock((el.session?.minutes ?? 5) * 60_000);
  // Kicker ~33px wide, 8px gap, clock at ~8px a digit: the pair centred.
  const kickerW = 33;
  const clockW = clock.length * 8;
  const x0 = cx - (kickerW + 8 + clockW) / 2;
  return (
    // Clipped to the rounded box, as the face's overflow-hidden clips them.
    `<clipPath id="dial-${xmlEscape(el.id)}"><rect x="${r2(el.x)}" y="${r2(el.y)}" width="${r2(el.width)}" height="${r2(el.height)}" rx="${r2(borderOf(el).radius)}"/></clipPath>` +
    `<g clip-path="url(#dial-${xmlEscape(el.id)})">${ticks}</g>` +
    text(x0, cy + 3.5, 'Timer', { size: 10, weight: 500, color, opacity: 0.7, uppercase: true }) +
    text(x0 + kickerW + 8, cy + 5, clock, { size: 14, weight: 600, color })
  );
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

// ReactionPadFace: a soft wash of the reaction's hues behind the emoji (the
// canvas's radial-gradient, 70% by 70% at 50% 42%), the emoji at
// min(34% of the width, 40% of the height) standing on its glowing spot, and
// the label in a quiet chip. Whether the emoji paints in colour depends on the
// renderer's emoji font, the bargain every emoji in an export makes.
function reactionPad(el: Face, cx: number, cy: number, title: string, color: string): string {
  const reaction = el.reaction ?? REACTION_DEFAULT;
  const [from, to] = REACTION_HUES[reaction];
  const id = xmlEscape(el.id);
  const size = Math.min(el.width * 0.34, el.height * 0.4);
  const spotH = el.height * 0.09;
  const chipH = title ? 17 : 0;
  const stack = size + spotH - el.height * 0.05 + (title ? 4 + chipH : 0);
  const top = cy - stack / 2;
  const spotY = top + size - el.height * 0.05;
  const chipW = Math.min(el.width - 16, title.length * 6.2 + 16);
  const chipY = spotY + spotH + 4;
  return (
    `<defs>` +
    `<radialGradient id="pad-wash-${id}" cx="0.5" cy="0.42" r="0.7"><stop offset="0" stop-color="${from}" stop-opacity="0.28"/><stop offset="0.55" stop-color="${to}" stop-opacity="0.1"/><stop offset="0.8" stop-color="${to}" stop-opacity="0"/></radialGradient>` +
    `<radialGradient id="pad-spot-${id}"><stop offset="0" stop-color="${from}" stop-opacity="0.55"/><stop offset="0.7" stop-color="${to}" stop-opacity="0.18"/><stop offset="1" stop-color="${to}" stop-opacity="0"/></radialGradient>` +
    `</defs>` +
    `<rect x="${r2(el.x)}" y="${r2(el.y)}" width="${r2(el.width)}" height="${r2(el.height)}" rx="${r2(borderOf(el).radius)}" fill="url(#pad-wash-${id})"/>` +
    `<ellipse cx="${r2(cx)}" cy="${r2(spotY + spotH / 2)}" rx="${r2(el.width * 0.23)}" ry="${r2(spotH / 2)}" fill="url(#pad-spot-${id})"/>` +
    `<text x="${r2(cx)}" y="${r2(top + size / 2)}" text-anchor="middle" dominant-baseline="central"` +
    ` font-size="${r2(size)}">${xmlEscape(REACTION_EMOJI[reaction])}</text>` +
    (title
      ? `<rect x="${r2(cx - chipW / 2)}" y="${r2(chipY)}" width="${r2(chipW)}" height="${chipH}" rx="${chipH / 2}" fill="${xmlEscape(color)}" fill-opacity="0.07"/>` +
        text(cx, chipY + 12, title, { size: 10.5, weight: 600, color, anchor: 'middle' })
      : '')
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

// RevealFace's cover (docs/specs/009-elements/reveal-zone.md "The look"): an opaque panel in the paper's
// tone with the self-painting wrapper's 4px corners, washed by two soft glows
// of its accent from opposite corners, a 1.5px accent border inside the box,
// then the column of a 40px lock disc (with its 6px halo), the label and the
// gesture chip, 8px apart. The sweep of light is motion and isn't reproduced.
const REVEAL_RADIUS_PX = 4;
function revealCover(
  el: Face,
  cx: number,
  cy: number,
  title: string,
  color: string,
  stroke: string,
  surface: CanvasSurface,
): string {
  const { x, y, width: w, height: h } = el;
  const a = xmlEscape(stroke);
  // Disc 40, gap 8, label ~17.5, gap 8, chip 21: the column centred.
  const top = cy - 47;
  const discY = top + 20;
  const gesture = 'Double-click to reveal';
  const chipW = gesture.length * 5.2 + 20;
  const chipY = top + 73.5;
  return (
    `<rect x="${r2(x)}" y="${r2(y)}" width="${r2(w)}" height="${r2(h)}" rx="${REVEAL_RADIUS_PX}" fill="${REVEAL_COVER_BASE[surface]}"/>` +
    glow(`reveal-a-${el.id}`, x, y, w, h, stroke, { cx: 0, cy: 0 }, 0.22, REVEAL_RADIUS_PX) +
    glow(`reveal-b-${el.id}`, x, y, w, h, stroke, { cx: 1, cy: 1 }, 0.16, REVEAL_RADIUS_PX) +
    `<rect x="${r2(x + 0.75)}" y="${r2(y + 0.75)}" width="${r2(w - 1.5)}" height="${r2(h - 1.5)}" rx="${REVEAL_RADIUS_PX - 0.75}" fill="none" stroke="${a}" stroke-opacity="0.55" stroke-width="1.5"/>` +
    `<circle cx="${r2(cx)}" cy="${r2(discY)}" r="26" fill="${a}" fill-opacity="0.07"/>` +
    `<circle cx="${r2(cx)}" cy="${r2(discY)}" r="20" fill="${REVEAL_COVER_BASE[surface]}"/>` +
    `<circle cx="${r2(cx)}" cy="${r2(discY)}" r="20" fill="${a}" fill-opacity="0.14"/>` +
    // qa-parts' LockGlyph, 18px on its 16-unit grid.
    `<svg x="${r2(cx - 9)}" y="${r2(discY - 9)}" width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="${a}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">` +
    `<rect x="3.5" y="7" width="9" height="6.5" rx="1.5"/><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2"/></svg>` +
    text(cx, top + 59.5, title || 'Hidden', { size: 14, weight: 600, color, anchor: 'middle' }) +
    `<rect x="${r2(cx - chipW / 2)}" y="${r2(chipY)}" width="${r2(chipW)}" height="21" rx="10.5" fill="${xmlEscape(color)}" fill-opacity="0.07"/>` +
    text(cx, chipY + 14.5, gesture, { size: 10.5, weight: 600, color, anchor: 'middle' })
  );
}

// PickerFace at rest: the reel window (a shade at the top and bottom lips,
// clear through the middle, paper-kit's ReelWindow) behind a column of the
// tracked kicker, the landed name at 17px, and the Pick / Again button.
function picker(
  el: Face,
  cx: number,
  cy: number,
  title: string,
  color: string,
  surface: CanvasSurface,
): string {
  const b = borderOf(el);
  const id = xmlEscape(el.id);
  const c = xmlEscape(color);
  const result = el.pickerResult;
  const action = result ? 'Again' : 'Pick';
  const buttonW = action.length * 6.4 + 24;
  // Kicker 15, gap 4, name 21, gap 4 + 2, button 24.5: the column centred,
  // one line shorter without a kicker.
  const top = cy - (title ? 35 : 25);
  const nameY = top + (title ? 19 : 0);
  return (
    `<defs><linearGradient id="reel-${id}" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="${c}" stop-opacity="0.16"/><stop offset="0.26" stop-color="${c}" stop-opacity="0"/>` +
    `<stop offset="0.74" stop-color="${c}" stop-opacity="0"/><stop offset="1" stop-color="${c}" stop-opacity="0.16"/>` +
    `</linearGradient></defs>` +
    `<rect x="${r2(el.x + b.width)}" y="${r2(el.y + b.width)}" width="${r2(el.width - b.width * 2)}" height="${r2(el.height - b.width * 2)}" rx="${r2(Math.max(0, b.radius - b.width))}" fill="url(#reel-${id})"/>` +
    (title
      ? text(cx, top + 11, title, {
          size: 10,
          weight: 500,
          color,
          anchor: 'middle',
          opacity: 0.6,
          uppercase: true,
          tracking: 0.08,
        })
      : '') +
    text(cx, nameY + 16, result ?? '—', { size: 17, weight: 600, color, anchor: 'middle' }) +
    pill(cx - buttonW / 2, nameY + 27, buttonW, 24.5, color, surface === 'dark' ? 0.1 : 0.06) +
    text(cx, nameY + 43, action, { size: 11, weight: 600, color, anchor: 'middle' })
  );
}
