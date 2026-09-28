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
import { REVEAL_COVER_BASE, type CanvasSurface } from './colors';
import { glow, pill, text, type Face } from './svg-render-face-kit';
import { svgActionPanel, svgCommentPanel } from './svg-render-panel-faces';

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
    case 'mode-button':
      // An icon over its label, the shape a toolbar button has.
      return (
        `<circle cx="${r2(cx)}" cy="${r2(cy - 12)}" r="11" fill="none" stroke="${xmlEscape(color)}" stroke-width="1.5" opacity="0.7"/>` +
        text(cx, cy + 16, title || 'Mode', { size: 12, weight: 600, color, anchor: 'middle' })
      );
    case 'session-button':
      // A stopwatch over the tool's name.
      return (
        `<circle cx="${r2(cx)}" cy="${r2(cy - 12)}" r="10" fill="none" stroke="${xmlEscape(color)}" stroke-width="1.5"/>` +
        `<path d="M ${r2(cx)} ${r2(cy - 18)} L ${r2(cx)} ${r2(cy - 12)} L ${r2(cx + 5)} ${r2(cy - 9)}" fill="none" stroke="${xmlEscape(color)}" stroke-width="1.5" stroke-linecap="round"/>` +
        text(cx, cy + 16, title || 'Session', { size: 12, weight: 600, color, anchor: 'middle' })
      );
    case 'reveal': {
      // The cover as the face draws it (docs/specs/009-elements/reveal-zone.md "The look"): an opaque panel
      // washed with its accent, a solid accent border, a lock, the label and
      // the gesture. The sweep of light is motion and isn't reproduced.
      if (el.revealed === true) return '';
      return (
        `<rect x="${r2(el.x)}" y="${r2(el.y)}" width="${r2(el.width)}" height="${r2(el.height)}" rx="10" fill="${REVEAL_COVER_BASE[surface]}"/>` +
        // The two soft glows of its accent, from opposite corners, then the border.
        glow(
          `reveal-a-${el.id}`,
          el.x,
          el.y,
          el.width,
          el.height,
          stroke,
          { cx: 0, cy: 0 },
          0.22,
          10,
        ) +
        glow(
          `reveal-b-${el.id}`,
          el.x,
          el.y,
          el.width,
          el.height,
          stroke,
          { cx: 1, cy: 1 },
          0.16,
          10,
        ) +
        `<rect x="${r2(el.x)}" y="${r2(el.y)}" width="${r2(el.width)}" height="${r2(el.height)}" rx="10" fill="none" stroke="${xmlEscape(stroke)}" stroke-opacity="0.55" stroke-width="1.5"/>` +
        `<circle cx="${r2(cx)}" cy="${r2(cy - 20)}" r="16" fill="${xmlEscape(stroke)}" fill-opacity="0.14"/>` +
        `<rect x="${r2(cx - 5)}" y="${r2(cy - 21)}" width="10" height="8" rx="1.8" fill="none" stroke="${xmlEscape(stroke)}" stroke-width="1.5"/>` +
        `<path d="M ${r2(cx - 3)} ${r2(cy - 21)} v -2.5 a 3 3 0 0 1 6 0 v 2.5" fill="none" stroke="${xmlEscape(stroke)}" stroke-width="1.5"/>` +
        text(cx, cy + 12, title || 'Hidden', { size: 14, weight: 600, color, anchor: 'middle' }) +
        text(cx, cy + 30, 'Double-click to reveal', {
          size: 10,
          weight: 600,
          color,
          anchor: 'middle',
          opacity: 0.6,
        })
      );
    }
    case 'picker':
      return (
        text(cx, cy - 10, title || 'Picker', {
          size: 10,
          weight: 600,
          color,
          anchor: 'middle',
          opacity: 0.6,
          uppercase: true,
        }) +
        text(cx, cy + 6, el.pickerResult ?? '—', {
          size: 15,
          weight: 600,
          color,
          anchor: 'middle',
        }) +
        pill(cx - 22, cy + 16, 44, 18, color, 0.14) +
        text(cx, cy + 28.5, 'Pick', { size: 10, weight: 600, color, anchor: 'middle' })
      );
    case 'reaction-pad': {
      // The pad's own emoji, sized against the pad the way the canvas sizes
      // it (46% of the smaller side). Whether it paints in colour depends on
      // the renderer's emoji font, which is the same bargain every other
      // emoji in an export makes.
      const reaction = el.reaction ?? REACTION_DEFAULT;
      const glyph = REACTION_EMOJI[reaction];
      const [from, to] = REACTION_HUES[reaction];
      const size = Math.min(el.width, el.height) * 0.4;
      const ey = cy - (title ? 4 : 0) + size * 0.5;
      // The reaction's glow and the spot it stands on (docs/specs/009-elements/reaction-pad.md "The look").
      return (
        `<ellipse cx="${r2(cx)}" cy="${r2(cy - 4)}" rx="${r2(el.width * 0.42)}" ry="${r2(el.height * 0.4)}" fill="${from}" fill-opacity="0.16"/>` +
        `<ellipse cx="${r2(cx)}" cy="${r2(ey)}" rx="${r2(el.width * 0.22)}" ry="${r2(el.height * 0.05)}" fill="${to}" fill-opacity="0.35"/>` +
        `<text x="${r2(cx)}" y="${r2(cy - (title ? 4 : 0))}" text-anchor="middle" dominant-baseline="central"` +
        ` font-size="${r2(size)}">${xmlEscape(glyph)}</text>` +
        (title
          ? text(cx, cy + size / 2 + 12, title, { size: 11, weight: 500, color, anchor: 'middle' })
          : '')
      );
    }
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
      return svgCommentPanel(el, title, color, stroke);
    case 'action-card':
      // docs/specs/012-collaboration/action-panel.md "The card": a row per action, the Add Action bar.
      return svgActionPanel(el, title, color, stroke);
    case 'portal': {
      // The ring, which is the whole element: an ellipse with a bright rim.
      const rx = Math.min(el.width, el.height) * 0.22;
      const ry = Math.min(el.width, el.height) * 0.42;
      return (
        `<ellipse cx="${r2(cx)}" cy="${r2(cy)}" rx="${r2(rx)}" ry="${r2(ry)}" fill="${xmlEscape(stroke)}" opacity="0.18"/>` +
        `<ellipse cx="${r2(cx)}" cy="${r2(cy)}" rx="${r2(rx)}" ry="${r2(ry)}" fill="none" stroke="${xmlEscape(stroke)}" stroke-width="3"/>`
      );
    }
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
