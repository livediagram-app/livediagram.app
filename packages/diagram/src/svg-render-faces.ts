// Behaviour and Collaborate faces in the headless render (spec/103 to /137).
//
// These fifteen kinds all exported as the SAME thing: a rounded box with the
// kind's name centred in it. Every workshop board came out of an export as a
// grid of identical rectangles, with no way to tell an agenda from a decision.
//
// What they draw here is each card's STRUCTURE, in its real colours and at its
// real scale: the title where the card puts it, the status line beside it, the
// body's own marks, the footer's pills. What it deliberately does not
// reproduce is the paper kit (spec/122) that gives each card its texture, and
// the pressed / live states of controls that cannot be pressed in a still
// image. A card is recognisable and readable rather than pixel-identical, and
// the comment on each face says which of its marks are which.
//
// Layout is in DESIGN units and then scaled, exactly as CollabScale does on
// the canvas: a card is composed at its kind's default size and scaled to the
// box, so a big one has bigger type rather than more padding.

import { SHAPE_DEFAULT_SIZE } from './shape-factory';
import { agendaTotalMinutes } from './collab-shapes';
import { REACTION_DEFAULT, REACTION_EMOJI } from './data-shapes';
import type { BoxedElement } from './index';
import { r2, xmlEscape } from './svg-render-primitives';

type Face = BoxedElement & { type: 'shape' };

/** The Behaviour kinds this module draws a face for, so the caller knows not
 *  to print the generic centred label over the top of one. */
export const BEHAVIOUR_FACE_SHAPES = new Set<string>([
  'mode-button',
  'session-button',
  'reveal',
  'picker',
  'reaction-pad',
  'comment-pin',
  'portal',
  'chair',
]);

const PAD_X = 16;
const PAD_Y = 14;
const TITLE_PX = 13;
const BODY_PX = 11;

const sans = ' font-family="system-ui, sans-serif"';

const text = (
  x: number,
  y: number,
  body: string,
  o: {
    size?: number;
    weight?: number;
    color: string;
    anchor?: 'start' | 'middle' | 'end';
    opacity?: number;
    uppercase?: boolean;
  },
): string =>
  `<text x="${r2(x)}" y="${r2(y)}"${sans} font-size="${o.size ?? BODY_PX}"` +
  ` font-weight="${o.weight ?? 400}" fill="${xmlEscape(o.color)}"` +
  `${o.anchor && o.anchor !== 'start' ? ` text-anchor="${o.anchor}"` : ''}` +
  `${o.opacity !== undefined ? ` opacity="${o.opacity}"` : ''}>` +
  `${xmlEscape(o.uppercase ? body.toUpperCase() : body)}</text>`;

const pill = (x: number, y: number, w: number, h: number, color: string, opacity = 0.12): string =>
  `<rect x="${r2(x)}" y="${r2(y)}" width="${r2(w)}" height="${r2(h)}" rx="${r2(h / 2)}" fill="${xmlEscape(color)}" opacity="${opacity}"/>`;

const rule = (x1: number, y: number, x2: number, color: string, opacity = 0.18): string =>
  `<path d="M ${r2(x1)} ${r2(y)} L ${r2(x2)} ${r2(y)}" stroke="${xmlEscape(color)}" stroke-width="1" opacity="${opacity}"/>`;

/** The card frame every Collaborate panel shares: the title, its status line,
 *  and the design-unit box the body is laid out in. */
function collabCard(
  el: Face,
  title: string,
  aside: string | undefined,
  color: string,
  body: (w: number, h: number) => string,
): string {
  const design = SHAPE_DEFAULT_SIZE[el.shape] ?? { width: el.width, height: el.height };
  const scale = Math.min(el.width / design.width, el.height / design.height);
  // The inner box in design units, so a card larger than its default still
  // paints edge to edge rather than leaving a band of bare card.
  const w = el.width / scale;
  const h = el.height / scale;
  const head =
    text(PAD_X, PAD_Y + TITLE_PX, title, { size: TITLE_PX, weight: 600, color }) +
    (aside
      ? text(w - PAD_X, PAD_Y + TITLE_PX, aside, {
          size: 10,
          weight: 500,
          color,
          anchor: 'end',
          opacity: 0.55,
          uppercase: true,
        })
      : '');
  return (
    `<g transform="translate(${r2(el.x)} ${r2(el.y)}) scale(${r2(scale)})">` +
    head +
    body(w, h) +
    `</g>`
  );
}

/** A row of small chips, the shape every "pick one of these" card wears. */
function chipRow(x: number, y: number, labels: readonly string[], color: string): string {
  let cx = x;
  return labels
    .map((value) => {
      const w = Math.max(18, value.length * 6 + 12);
      const out =
        pill(cx, y, w, 16, color) +
        text(cx + w / 2, y + 11.5, value, { size: 10, weight: 500, color, anchor: 'middle' });
      cx += w + 5;
      return out;
    })
    .join('');
}

/** The footer's action pills, which say what the card DOES. */
function footerPills(x: number, y: number, labels: readonly string[], color: string): string {
  let cx = x;
  return labels
    .map((value) => {
      const w = value.length * 5.6 + 18;
      const out =
        pill(cx, y, w, 18, color, 0.14) +
        text(cx + w / 2, y + 12.5, value, { size: 10, weight: 600, color, anchor: 'middle' });
      cx += w + 8;
      return out;
    })
    .join('');
}

// ── Collaborate panels (spec/123 to /129, /137) ─────────────────────────

export function svgCollabFace(el: Face, label: string, color: string): string | null {
  const title = label.trim();
  switch (el.shape) {
    case 'estimate': {
      const values =
        el.estimateScale === 'tshirt'
          ? ['XS', 'S', 'M', 'L', 'XL']
          : ['1', '2', '3', '5', '8', '13'];
      const answered = (el.responses ?? []).length;
      return collabCard(
        el,
        title || 'Estimate',
        answered ? `${answered} answered` : undefined,
        color,
        (w, h) =>
          chipRow(PAD_X, PAD_Y + TITLE_PX + 10, values, color) +
          footerPills(PAD_X, h - PAD_Y - 18, ['Reveal', 'Clear'], color) +
          (answered === 0
            ? text(w / 2, h / 2, 'Nobody has picked yet', {
                size: 10,
                color,
                anchor: 'middle',
                opacity: 0.45,
              })
            : ''),
      );
    }
    case 'temperature': {
      const answered = (el.responses ?? []).length;
      return collabCard(
        el,
        title || 'How are we feeling?',
        answered ? `${answered} answered` : undefined,
        color,
        (w, h) =>
          chipRow(PAD_X, PAD_Y + TITLE_PX + 10, ['1', '2', '3', '4', '5'], color) +
          (answered === 0
            ? text(PAD_X, PAD_Y + TITLE_PX + 48, 'No readings yet', {
                size: 10,
                color,
                opacity: 0.45,
              })
            : '') +
          rule(PAD_X, h - PAD_Y - 6, w - PAD_X, color),
      );
    }
    case 'idea-box': {
      const count = (el.responses ?? []).length;
      return collabCard(
        el,
        title || 'Ideas',
        count ? `${count} ${count === 1 ? 'idea' : 'ideas'}` : undefined,
        color,
        (w, h) =>
          // The input row and its Add pill: the two marks that say "you write
          // into this one".
          `<rect x="${r2(PAD_X)}" y="${r2(PAD_Y + TITLE_PX + 8)}" width="${r2(w - PAD_X * 2 - 34)}" height="18" rx="4" fill="none" stroke="${xmlEscape(color)}" stroke-width="1" opacity="0.3"/>` +
          footerPills(w - PAD_X - 30, PAD_Y + TITLE_PX + 8, ['Add'], color) +
          text(PAD_X, PAD_Y + TITLE_PX + 44, 'Nothing in the box yet', {
            size: 10,
            color,
            opacity: 0.45,
          }) +
          footerPills(PAD_X, h - PAD_Y - 18, ['Open the box'], color),
      );
    }
    case 'agenda': {
      const items = el.agendaItems ?? [];
      const total = agendaTotalMinutes(items);
      return collabCard(
        el,
        title || 'Agenda',
        items.length ? `${total}m` : undefined,
        color,
        (w, h) => {
          // Ruled paper: the agenda's own backdrop, and the thing that makes
          // it readable as a running order rather than a list.
          const lines: string[] = [];
          for (let y = PAD_Y + TITLE_PX + 18; y < h - PAD_Y; y += 16)
            lines.push(rule(PAD_X, y, w - PAD_X, color, 0.12));
          const rows = items.length
            ? items
                .slice(0, 6)
                .map((item, i) =>
                  text(PAD_X + 2, PAD_Y + TITLE_PX + 14 + i * 16, item.label, {
                    size: BODY_PX,
                    color,
                  }),
                )
                .join('')
            : text(PAD_X, PAD_Y + TITLE_PX + 16, 'No segments yet', {
                size: 10,
                color,
                opacity: 0.45,
              });
          return lines.join('') + rows;
        },
      );
    }
    case 'decision':
      return collabCard(
        el,
        title || 'We will …',
        'Proposed',
        color,
        (w, h) =>
          text(PAD_X, PAD_Y + TITLE_PX + 22, 'No drivers yet', {
            size: 10,
            color,
            opacity: 0.45,
          }) + rule(PAD_X, h - PAD_Y - 6, w - PAD_X, color),
      );
    case 'roll-call': {
      const entries = el.rollCall ?? [];
      return collabCard(
        el,
        title || 'Roll call',
        entries.length ? `${entries.length} present` : undefined,
        color,
        (_w, h) =>
          (entries.length
            ? entries
                .slice(0, 6)
                .map((e, i) =>
                  text(PAD_X, PAD_Y + TITLE_PX + 20 + i * 15, e.name ?? '', {
                    size: BODY_PX,
                    color,
                  }),
                )
                .join('')
            : text(PAD_X, PAD_Y + TITLE_PX + 20, 'Nobody recorded yet', {
                size: 10,
                color,
                opacity: 0.45,
              })) + footerPills(PAD_X, h - PAD_Y - 18, ['Take roll'], color),
      );
    }
    case 'done-check': {
      const done = (el.responses ?? []).length;
      return collabCard(
        el,
        title || 'Everyone done?',
        `${done}/${Math.max(done, 1)}`,
        color,
        (_w, h) =>
          text(PAD_X, PAD_Y + TITLE_PX + 20, 'Waiting on', {
            size: 10,
            weight: 600,
            color,
            opacity: 0.6,
            uppercase: true,
          }) + footerPills(PAD_X, h - PAD_Y - 18, ["I'm done"], color),
      );
    }
    default:
      return null;
  }
}

// ── Behaviour elements (spec/103 to /107, /135, /136) ───────────────────

/** The eye a reveal's cover carries, drawn at `size` about (cx, cy). */
function eye(cx: number, cy: number, size: number, color: string): string {
  const w = size;
  const h = size * 0.62;
  return (
    `<path d="M ${r2(cx - w / 2)} ${r2(cy)} Q ${r2(cx)} ${r2(cy - h)} ${r2(cx + w / 2)} ${r2(cy)} Q ${r2(cx)} ${r2(cy + h)} ${r2(cx - w / 2)} ${r2(cy)} Z"` +
    ` fill="none" stroke="${xmlEscape(color)}" stroke-width="1.5"/>` +
    `<circle cx="${r2(cx)}" cy="${r2(cy)}" r="${r2(size * 0.17)}" fill="${xmlEscape(color)}"/>`
  );
}

export function svgBehaviourFace(
  el: Face,
  label: string,
  color: string,
  stroke: string,
): string | null {
  const cx = el.x + el.width / 2;
  const cy = el.y + el.height / 2;
  const title = label.trim();
  switch (el.shape) {
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
      // The cover: a dashed panel with its eye and its instruction. The
      // scratch-panel hatching is the one mark not reproduced.
      if (el.revealed === true) return '';
      return (
        `<rect x="${r2(el.x)}" y="${r2(el.y)}" width="${r2(el.width)}" height="${r2(el.height)}" rx="6"` +
        ` fill="#f1f5f9" stroke="${xmlEscape(stroke)}" stroke-width="2" stroke-dasharray="6 4"/>` +
        eye(cx, cy - 14, 22, color) +
        text(cx, cy + 8, title || 'Hidden', { size: 13, weight: 600, color, anchor: 'middle' }) +
        text(cx, cy + 24, 'Double-click to reveal', {
          size: 10,
          weight: 500,
          color,
          anchor: 'middle',
          opacity: 0.6,
          uppercase: true,
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
      const glyph = REACTION_EMOJI[el.reaction ?? REACTION_DEFAULT];
      const size = Math.min(el.width, el.height) * 0.46;
      return (
        `<text x="${r2(cx)}" y="${r2(cy - (title ? 4 : 0))}" text-anchor="middle" dominant-baseline="central"` +
        ` font-size="${r2(size)}">${xmlEscape(glyph)}</text>` +
        (title
          ? text(cx, cy + size / 2 + 12, title, { size: 11, weight: 500, color, anchor: 'middle' })
          : '')
      );
    }
    case 'chair': {
      // The chair itself (spec/130), on its own 64x72 grid: backrest, slat,
      // seat, legs and stretcher, plus the contact shadow that sits it on the
      // canvas rather than floating it over.
      const seat = el.fillColor ?? '#e2e8f0';
      const line = xmlEscape(stroke);
      return (
        `<svg x="${r2(el.x)}" y="${r2(el.y)}" width="${r2(el.width)}" height="${r2(el.height)}" viewBox="0 0 64 72" preserveAspectRatio="xMidYMid meet" overflow="visible">` +
        `<ellipse cx="32" cy="66" rx="19" ry="4" fill="#0f172a" opacity="0.12"/>` +
        `<rect x="17" y="3" width="30" height="31" rx="4" fill="${xmlEscape(seat)}" stroke="${line}" stroke-width="2"/>` +
        `<path d="M32 8v21" stroke="${line}" stroke-width="1.5" opacity="0.5" fill="none"/>` +
        `<rect x="10" y="34" width="44" height="13" rx="3" fill="${xmlEscape(seat)}" stroke="${line}" stroke-width="2"/>` +
        `<path d="M15 47v16M49 47v16" stroke="${line}" stroke-width="2.5" stroke-linecap="round" fill="none"/>` +
        `<path d="M15 57h34" stroke="${line}" stroke-width="1.5" opacity="0.5" fill="none"/>` +
        `</svg>`
      );
    }
    case 'comment-pin': {
      const count = el.commentThread?.comments.length ?? 0;
      return (
        text(el.x + 12, el.y + 22, `${count} ${count === 1 ? 'comment' : 'comments'}`, {
          size: 12,
          weight: 600,
          color,
        }) +
        text(el.x + 12, el.y + 42, count === 0 ? 'Nothing yet.' : '', {
          size: 11,
          color,
          opacity: 0.55,
        })
      );
    }
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
