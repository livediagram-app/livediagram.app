// The Estimate card in the headless render (docs/specs/012-collaboration/estimate-card.md "The look"),
// drawn as the canvas's EstimateFace draws it: the scale's 52px cards, then
// the room's cards centred in the space under them (face down in the accent
// before the reveal, with the share answered as a bar; face up after, sorted
// low to high with the spread and its two ends ringed), and the one act in the
// footer (Reveal with its count, or New round). An estimate stores an opaque
// key per answer, not a name, so people are neutral discs.

import {
  estimateRank,
  estimateScalePending,
  estimateSpread,
  estimateSpreadLabel,
  estimateValues,
  ESTIMATE_SCALE_LABELS,
  ESTIMATE_SCALE_VALUES,
  ESTIMATE_SCALES,
} from './collab-shapes';
import { r2, xmlEscape } from './svg-render-primitives';
import {
  collabCard,
  PAD_X,
  PAD_Y,
  text,
  type CollabAccent,
  type Face,
} from './svg-render-face-kit';
import {
  ACCENT_BAR_H,
  accentBar,
  BODY_GAP,
  BODY_TOP,
  GLYPH,
  roundRect,
} from './svg-render-collab-parts';

const PICK_H = 52;
const CARD_W = 34;
const CARD_H = 46;

// One of the room's cards (EstimateTable's Card): face down in the accent, or
// face up with the value, ringed at the spread's ends, filled when unanimous;
// a neutral person disc at its foot.
function roomCard(
  x: number,
  y: number,
  color: string,
  a: CollabAccent,
  face: { value: string; ringed: boolean; filled: boolean } | null,
): string {
  const fill = face?.filled ? a.accent : face ? color : a.accent;
  const fillOp = face?.filled ? 1 : face ? 0.05 : 0.18;
  const stroke = face?.ringed ? a.accent : face ? color : a.accent;
  const strokeOp = face?.ringed ? 1 : face ? 0.16 : 0.4;
  return (
    (face?.ringed
      ? roundRect(x - 2, y - 2, CARD_W + 4, CARD_H + 4, 10, a.accent, 0, {
          color: a.accent,
          opacity: 0.35,
        })
      : '') +
    roundRect(x, y, CARD_W, CARD_H, 8, fill, fillOp, { color: stroke, opacity: strokeOp }) +
    (face
      ? text(x + CARD_W / 2, y + 28.5, face.value, {
          size: 15,
          weight: 700,
          color: face.filled ? a.on : color,
          anchor: 'middle',
        })
      : '') +
    `<circle cx="${r2(x + CARD_W / 2)}" cy="${r2(y + CARD_H)}" r="8" fill="${xmlEscape(color)}" fill-opacity="0.2"/>`
  );
}

export function svgEstimate(el: Face, title: string, color: string, a: CollabAccent): string {
  const scale = el.estimateScale;
  const responses = el.responses ?? [];
  const revealed = el.responsesRevealed === true;
  const n = responses.length;
  return collabCard(
    el,
    title || 'Estimate',
    n ? `${n}/${n} answered` : undefined,
    color,
    (w, h) => {
      const inner = w - PAD_X * 2;
      if (estimateScalePending(el)) {
        const rowH = 42;
        return (
          text(PAD_X, BODY_TOP + 12, 'Choose a scale', { size: 12, weight: 600, color }) +
          ESTIMATE_SCALES.map((sc, i) => {
            const y = BODY_TOP + 24 + i * (rowH + 6);
            return (
              roundRect(PAD_X, y, inner, rowH, 10, color, 0.04, { color, opacity: 0.14 }) +
              text(PAD_X + 12, y + 18, ESTIMATE_SCALE_LABELS[sc], {
                size: 11.5,
                weight: 600,
                color,
              }) +
              text(PAD_X + 12, y + 32, ESTIMATE_SCALE_VALUES[sc].join(' · '), {
                size: 10,
                color,
                opacity: 0.55,
              })
            );
          }).join('')
        );
      }
      // The scale's cards, centred at up to 52px each.
      const values = estimateValues(scale);
      const gap = 6;
      const cw = Math.min(52, (inner - gap * (values.length - 1)) / values.length);
      const rowW = cw * values.length + gap * (values.length - 1);
      const x0 = PAD_X + (inner - rowW) / 2;
      let out = values
        .map((v, i) => {
          const x = x0 + i * (cw + gap);
          return (
            roundRect(x, BODY_TOP, cw, PICK_H, 12, color, 0.04, { color, opacity: 0.14 }) +
            text(x + cw / 2, BODY_TOP + 31, v, { size: 15, weight: 700, color, anchor: 'middle' })
          );
        })
        .join('');
      // The footer's one act.
      const footerY = h - PAD_Y - ACCENT_BAR_H;
      if (!revealed && n > 0) {
        out += accentBar(PAD_X, footerY, inner, 'Reveal', a, GLYPH.eye, n);
      } else if (revealed) {
        out += accentBar(PAD_X, footerY, inner, 'New round', a, GLYPH.reopen);
      }
      const areaTop = BODY_TOP + PICK_H + BODY_GAP;
      const areaBottom = (n > 0 || revealed ? footerY : h - PAD_Y) - BODY_GAP;
      const mid = (areaTop + areaBottom) / 2;
      if (n === 0) {
        return (
          out + text(w / 2, mid, 'No picks yet', { size: 12, weight: 600, color, anchor: 'middle' })
        );
      }
      const shown = responses.slice(0, 8);
      const handW = shown.length * CARD_W + (shown.length - 1) * 8;
      const hx = w / 2 - handW / 2;
      if (!revealed) {
        // Cards (54 tall with the disc) + 12 + the 6px share bar, centred.
        const top = mid - (54 + 12 + 6) / 2;
        const barW = Math.min(220, inner);
        out += shown.map((_, i) => roomCard(hx + i * (CARD_W + 8), top, color, a, null)).join('');
        out +=
          roundRect(w / 2 - barW / 2, top + 66, barW, 6, 3, color, 0.08) +
          roundRect(w / 2 - barW / 2, top + 66, barW, 6, 3, a.accent, 1);
        return out;
      }
      const spread = estimateSpread(
        scale,
        responses.map((r) => r.value),
      );
      const unanimous = spread.kind === 'unanimous';
      const label = estimateSpreadLabel(spread);
      const chipW = label.length * 6 + 20;
      const top = mid - (24 + 12 + 54) / 2;
      out += roundRect(
        w / 2 - chipW / 2,
        top,
        chipW,
        24,
        12,
        unanimous ? a.accent : color,
        unanimous ? 0.16 : 0.08,
      );
      out += text(w / 2, top + 16, label, {
        size: 10.5,
        weight: 700,
        color: unanimous ? a.ink : color,
        anchor: 'middle',
      });
      const sorted = [...shown].sort(
        (p, q) => estimateRank(scale, p.value) - estimateRank(scale, q.value),
      );
      out += sorted
        .map((r, i) =>
          roomCard(hx + i * (CARD_W + 8), top + 36, color, a, {
            value: r.value,
            ringed: spread.kind === 'range' && (r.value === spread.low || r.value === spread.high),
            filled: unanimous,
          }),
        )
        .join('');
      return out;
    },
  );
}
