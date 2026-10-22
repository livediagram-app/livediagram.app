// Behaviour faces in the headless render (docs/specs/012-collaboration/session-button.md to /137): the
// session buttons, the picker, the comment and action panels, the portal. The Collaborate panels have their
// own module (svg-render-collab-faces.ts); both draw with svg-render-face-kit.ts.
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

import { r2, xmlEscape } from './svg-render-primitives';
import { formatTimerClock } from './session';
import { sessionButtonPlan, type SessionButtonConfig } from './behaviour-config';
import { sessionButtonText } from './session-button-text';
import { borderOf } from './svg-render-border';
import type { CanvasSurface } from './colors';
import { collabAccent, fitLine, pill, text, wrapLines, type Face } from './svg-render-face-kit';
import { svgActionPanel, svgCommentPanel } from './svg-render-panel-faces';

/** The Behaviour kinds this module draws a face for, so the caller knows not
 *  to print the generic centred label over the top of one. */
export const BEHAVIOUR_FACE_SHAPES = new Set<string>([
  'session-button',
  'picker',
  'comment-pin',
  'action-card',
  'portal',
]);

// ── Behaviour elements (docs/specs/012-collaboration/session-button.md, picker.md, /135, /136) ──────────

export function svgBehaviourFace(
  el: Face,
  label: string,
  color: string,
  stroke: string,
  // The paper under the element, for the faces whose look follows it (the
  // Picker's button), exactly as the canvas face reads it.
  surface: CanvasSurface = 'light',
  // The card's resolved fill, for the Comment and Action panels' accent ink.
  fill?: string,
): string | null {
  const cx = el.x + el.width / 2;
  const cy = el.y + el.height / 2;
  const title = label.trim();
  switch (el.shape) {
    case 'session-button': {
      // The tool as the canvas reads it, through its plan: a missing or unknown tool is the timer.
      const tool = sessionButtonPlan(el.session).tool;
      // A timer reads as the canvas's idle dial (SessionTimerFace): ticks
      // along the top edge, the kicker and the configured length. The Start
      // control is editor chrome and stays out of the image.
      if (tool === 'timer') return timerFace(el, cx, cy, color);
      // The other tools: the tool's glyph (SessionButtonFace's), over its label or, with none, what pressing it does
      // ("Start vote" over "3 dots each").
      return sessionToolGlyph(tool, cx, cy - 12, color) + sessionWords(el, title, cx, cy, color);
    }
    case 'picker':
      return picker(el, cx, cy, title, color, surface);
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

// A Session tool's glyph, 20 px, centred at (x, y): a stopwatch or three vote dots.
function sessionToolGlyph(tool: string | undefined, x: number, y: number, color: string): string {
  const ink = xmlEscape(color);
  if (tool === 'vote')
    return [-7, 0, 7]
      .map((dx) => `<circle cx="${r2(x + dx)}" cy="${r2(y)}" r="3" fill="${ink}"/>`)
      .join('');
  return (
    `<circle cx="${r2(x)}" cy="${r2(y)}" r="10" fill="none" stroke="${ink}" stroke-width="1.5"/>` +
    `<path d="M ${r2(x)} ${r2(y - 6)} L ${r2(x)} ${r2(y)} L ${r2(x + 5)} ${r2(y + 3)}" fill="none" stroke="${ink}" stroke-width="1.5" stroke-linecap="round"/>`
  );
}

// A Session button's words: its own label, or what pressing it does, as the editor's face says it.
function sessionWords(
  el: { session?: SessionButtonConfig; width: number },
  title: string,
  cx: number,
  cy: number,
  color: string,
): string {
  // Within the button, as the canvas's face clamps them: the kicker on one line, the action on at most two.
  const room = Math.max(24, el.width - 16);
  if (title)
    return text(cx, cy + 16, fitLine(title, room, 12), {
      size: 12,
      weight: 600,
      color,
      anchor: 'middle',
    });
  const { kicker, action } = sessionButtonText(sessionButtonPlan(el.session));
  const lines = wrapLines(action, room, 12, 2);
  return (
    text(cx, cy + 12, fitLine(kicker, room, 9), {
      size: 9,
      weight: 500,
      color,
      anchor: 'middle',
      opacity: 0.7,
      uppercase: true,
    }) +
    lines
      .map((line, i) =>
        text(cx, cy + 27 + i * 14, line, { size: 12, weight: 600, color, anchor: 'middle' }),
      )
      .join('')
  );
}
