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

import { isRetiredElement, RETIRED_SHAPE_KINDS } from './retired-elements';
import type { ResolveEmojiArt } from './svg-render-describe';
import { r2, xmlEscape } from './svg-render-primitives';
import { DEFAULT_BUTTON_MODE, SELECTION_MODE_LABEL, sessionButtonPlan } from './selection-mode';
import { type CanvasSurface } from './colors';
import { collabAccent, text, type Face } from './svg-render-face-kit';
import { svgActionPanel, svgCommentPanel } from './svg-render-panel-faces';
import { glyphStrokePx, iconPrimsMarkup, strokeUnits } from '@liveworkspace/icons';
import { MODE_GLYPHS } from './mode-glyphs';
import {
  keycapEdge,
  picker,
  portalArt,
  reactionPad,
  retiredFace,
  revealCover,
  sessionToolGlyph,
  sessionWords,
  timerFace,
} from './svg-render-behaviour-parts';

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
  // The retired Spaces pieces (docs/specs/009-elements/retired-elements.md): their placeholder card.
  ...RETIRED_SHAPE_KINDS,
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
  // An emoji's art, for the reaction pad's glyph where no emoji font is.
  resolveEmojiArt?: ResolveEmojiArt,
): string | null {
  const cx = el.x + el.width / 2;
  const cy = el.y + el.height / 2;
  const title = label.trim();
  // A retired piece, or an Avatar button (docs/specs/009-elements/retired-elements.md): the placeholder card, as on
  // the canvas.
  if (isRetiredElement(el)) return retiredFace(el, title, surface);
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
    case 'session-button': {
      // The tool as the canvas reads it, through its plan: a missing or unknown tool is the timer, and a poll not
      // set up yet is still a poll.
      const tool =
        sessionButtonPlan(el.session)?.tool ?? (el.session?.tool === 'poll' ? 'poll' : 'timer');
      // A timer reads as the canvas's idle dial (SessionTimerFace): ticks
      // along the top edge, the kicker and the configured length. The Start
      // control is editor chrome and stays out of the image.
      if (tool === 'timer') return timerFace(el, cx, cy, color);
      // The other tools: the tool's glyph (SessionButtonFace's), over its label or, with none, what pressing it does
      // ("Start vote" over "3 dots each").
      return sessionToolGlyph(tool, cx, cy - 12, color) + sessionWords(el, title, cx, cy, color);
    }
    case 'reveal':
      return el.revealed === true ? '' : revealCover(el, cx, cy, title, color, stroke, surface);
    case 'picker':
      return picker(el, cx, cy, title, color, surface);
    case 'reaction-pad':
      return reactionPad(el, cx, cy, title, color, resolveEmojiArt);
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
