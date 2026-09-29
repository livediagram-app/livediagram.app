// The Roll call card in the headless render (docs/specs/012-collaboration/roll-call.md "The face"), drawn as
// RollCallFace draws it: a header block with the count large over PRESENT,
// an overlapping stack of the first five people ringed in the card's fill,
// and the time the roll was taken in a chip on the right; then everyone as a
// chip; the Take again bar in the accent at the foot. An empty card shows the
// EmptyRows invitation instead.

import type { RollCallEntry } from './collab-shapes';
import { initialsOf } from './names';
import { r2, xmlEscape } from './svg-render-primitives';
import {
  collabCard,
  PAD_X,
  PAD_Y,
  personDisc,
  pill,
  text,
  wrapLines,
  type CollabAccent,
  type Face,
} from './svg-render-face-kit';
import {
  ACCENT_BAR_H,
  accentBar,
  BODY_GAP,
  BODY_TOP,
  GLYPH,
  glyph,
} from './svg-render-collab-parts';

// The stack shows this many people before a "+n" disc (RollCallFace STACK).
const STACK = 5;
const BLOCK_H = 57;
const CHIP_H = 24;

// RollCallFace.takenLabel: the time alone when taken today, else with the date.
function takenLabel(at: number, now: number): string {
  const d = new Date(at);
  const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  return new Date(now).toDateString() === d.toDateString()
    ? time
    : `${time} · ${d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`;
}

export function svgRollCall(
  el: Face,
  title: string,
  color: string,
  a: CollabAccent,
  surface: string,
): string {
  const entries = el.rollCall ?? [];
  return collabCard(el, title || 'Roll call', undefined, color, (w, h) => {
    const inner = w - PAD_X * 2;
    const barY = h - PAD_Y - ACCENT_BAR_H;
    const foot = accentBar(
      PAD_X,
      barY,
      inner,
      entries.length ? 'Take again' : 'Take roll',
      a,
      GLYPH.roll,
    );
    if (entries.length === 0) {
      const hint = wrapLines('Take the roll to freeze who is here into the diagram.', 170, 11, 3);
      const cy = (BODY_TOP + barY - BODY_GAP) / 2 - hint.length * 9;
      return (
        `<circle cx="${r2(w / 2)}" cy="${r2(cy - 14)}" r="14" fill="${xmlEscape(a.accent)}" fill-opacity="0.14"/>` +
        glyph(w / 2, cy - 14, 14, a.ink, GLYPH.spark) +
        text(w / 2, cy + 20, 'Nobody recorded yet', {
          size: 12.5,
          weight: 600,
          color,
          anchor: 'middle',
        }) +
        hint
          .map((line, i) =>
            text(w / 2, cy + 38 + i * 18, line, {
              size: 11,
              color,
              anchor: 'middle',
              opacity: 0.55,
            }),
          )
          .join('') +
        foot
      );
    }
    const top = BODY_TOP;
    const person = (e: RollCallEntry) => ({ initials: initialsOf(e.name), fill: e.color });
    // The count column is as wide as its tracked PRESENT; the stack follows 12px on.
    let out =
      `<rect x="${r2(PAD_X)}" y="${r2(top)}" width="${r2(inner)}" height="${BLOCK_H}" rx="12" fill="${xmlEscape(color)}" fill-opacity="0.04"/>` +
      text(PAD_X + 12, top + 27.5, String(entries.length), { size: 22, weight: 700, color }) +
      text(PAD_X + 12, top + 44, 'Present', {
        size: 10,
        weight: 600,
        color,
        opacity: 0.55,
        uppercase: true,
        tracking: 0.06,
      });
    const stackX = PAD_X + 12 + 52 + 12;
    const midY = top + BLOCK_H / 2;
    const shown = entries.slice(0, STACK);
    shown.forEach((e, i) => {
      // A 2px ring in the card's fill, outside the 24px disc.
      const cx = stackX + 12 + i * 16;
      out +=
        `<circle cx="${r2(cx)}" cy="${r2(midY)}" r="14" fill="${xmlEscape(surface)}"/>` +
        personDisc(cx, midY, 12, color, person(e));
    });
    if (entries.length > STACK) {
      const cx = stackX + 12 + STACK * 16;
      out +=
        `<circle cx="${r2(cx)}" cy="${r2(midY)}" r="14" fill="${xmlEscape(surface)}"/>` +
        `<circle cx="${r2(cx)}" cy="${r2(midY)}" r="12" fill="${xmlEscape(color)}" fill-opacity="0.12"/>` +
        text(cx, midY + 3.5, `+${entries.length - STACK}`, {
          size: 9.5,
          weight: 700,
          color,
          anchor: 'middle',
        });
    }
    const takenAt = entries[0]?.at;
    if (takenAt !== undefined) {
      const when = takenLabel(takenAt, Date.now());
      const cw = when.length * 5.4 + 16;
      const cx = PAD_X + inner - 12 - cw;
      out +=
        pill(cx, midY - 9.5, cw, 19, color, 0.07) +
        text(cx + cw / 2, midY + 3.5, when, { size: 10, weight: 500, color, anchor: 'middle' });
    }
    // Everyone as a chip, wrapping, 6px apart; rows that would reach the bar
    // are left out, as the card's overflow clips them.
    let x = PAD_X;
    let y = top + BLOCK_H + 10;
    for (const e of entries) {
      const cw = Math.min(inner, 2 + 20 + 6 + e.name.length * 5.9 + 10);
      if (x + cw > PAD_X + inner) {
        x = PAD_X;
        y += CHIP_H + 6;
      }
      if (y + CHIP_H > barY - BODY_GAP) break;
      out +=
        pill(x, y, cw, CHIP_H, color, 0.06) +
        personDisc(x + 12, y + CHIP_H / 2, 10, color, person(e)) +
        text(x + 28, y + 16, e.name, { size: 11, weight: 500, color });
      x += cw + 6;
    }
    return out + foot;
  });
}
