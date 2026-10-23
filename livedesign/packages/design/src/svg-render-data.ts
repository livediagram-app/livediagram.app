// Data elements in the headless render (docs/specs/009-elements/progress.md, /51, /52, /100, /120):
// progress bars and rings, and ratings.
//
// Every one of these drew NOTHING before: the exporter had no branch for them,
// so they fell through to the generic box and an exported progress bar was an
// empty pill, a rating an empty rectangle, a record a box with only its title.
// For elements whose content IS a value, that is a blank rather than a
// degraded render.
//
// Geometry mirrors each element's canvas view exactly; only the primitives
// differ (SVG here, HTML + CSS there). The looping animations are the canvas's
// alone: each one's resting frame is the static element, which is what a still
// image wants anyway.

import { capBandBaselineY } from '@livedesign/icons';
import { clampPercent, clampRating, RATING_DEFAULT, RATING_MAX } from './data-shapes';
import type { BoxedElement } from './index';
import { r2, xmlEscape } from './svg-render-primitives';
import { progressLabelInks } from './progress-colours';

type Data = BoxedElement & { type: 'shape' };

const MUTED_RULE = '#cbd5e1';

const sans = (fontFamily?: string) =>
  ` font-family="${xmlEscape(fontFamily ?? 'system-ui, sans-serif')}"`;

/** The percentage label's size, in px; the canvas view draws it at the same size (text-sm). */
const PROGRESS_LABEL_PX = 14;

/** The centred percentage every progress element carries, on its cap band (optical-alignment.md).
 *  `dx` / `dy` shift it into a nested viewport's own coordinates. */
function progressLabel(
  el: Data,
  pct: number,
  textColor: string,
  fontFamily?: string,
  dx = 0,
  dy = 0,
): string {
  const y = capBandBaselineY(el.y + el.height / 2, PROGRESS_LABEL_PX) - dy;
  return (
    `<text x="${r2(el.x + el.width / 2 - dx)}" y="${r2(y)}" text-anchor="middle"` +
    `${sans(fontFamily)} font-size="${PROGRESS_LABEL_PX}" font-weight="600"` +
    ` fill="${xmlEscape(textColor)}">${pct}%</text>`
  );
}

/** The bar's percentage, inked per part (docs/specs/009-elements/progress.md "The percentage stays
 *  legible"): one label when the filled portion and the track want the same ink, else one per part,
 *  each clipped by a nested `<svg>` viewport (no ids, so any number of bars share a design). */
function progressBarLabel(
  el: Data,
  pct: number,
  fillW: number,
  accent: string,
  track: string,
  textColor: string,
  fontFamily?: string,
): string {
  const ink = progressLabelInks(textColor, accent, track);
  if (ink.onFill === ink.onTrack || fillW <= 0) {
    return progressLabel(el, pct, fillW > 0 ? ink.onFill : ink.onTrack, fontFamily);
  }
  if (fillW >= el.width) return progressLabel(el, pct, ink.onFill, fontFamily);
  const part = (x: number, w: number, colour: string) =>
    `<svg x="${r2(x)}" y="${r2(el.y)}" width="${r2(w)}" height="${r2(el.height)}" overflow="hidden">` +
    progressLabel(el, pct, colour, fontFamily, x, el.y) +
    `</svg>`;
  return part(el.x, fillW, ink.onFill) + part(el.x + fillW, el.width - fillW, ink.onTrack);
}

/** A progress bar: a pill track with the filled portion in the accent. */
export function svgProgressBar(
  el: Data,
  accent: string,
  track: string,
  textColor: string,
  fontFamily?: string,
): string {
  const pct = clampPercent(el.progress ?? 50);
  const r = el.height / 2;
  const fillW = (el.width * pct) / 100;
  return (
    `<rect x="${r2(el.x)}" y="${r2(el.y)}" width="${r2(el.width)}" height="${r2(el.height)}" rx="${r2(r)}" fill="${xmlEscape(track)}" data-marker-shape=""/>` +
    (fillW > 0
      ? `<rect x="${r2(el.x)}" y="${r2(el.y)}" width="${r2(fillW)}" height="${r2(el.height)}" rx="${r2(r)}" fill="${xmlEscape(accent)}" data-marker-shape=""/>`
      : '') +
    progressBarLabel(el, pct, fillW, accent, track, textColor, fontFamily)
  );
}

/** A progress ring: a donut, its arc sweeping clockwise from twelve o'clock. */
export function svgProgressRing(
  el: Data,
  accent: string,
  track: string,
  textColor: string,
  fontFamily?: string,
): string {
  const pct = clampPercent(el.progress ?? 50);
  const STROKE = 13;
  const R = 50 - STROKE / 2 - 1;
  // Nested on the canvas view's own 100x100 grid, so the ring keeps its
  // proportions in any box, exactly as the canvas's viewBox does.
  const ring =
    `<svg x="${r2(el.x)}" y="${r2(el.y)}" width="${r2(el.width)}" height="${r2(el.height)}" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" overflow="visible">` +
    `<circle cx="50" cy="50" r="${R}" fill="none" stroke="${xmlEscape(track)}" stroke-width="${STROKE}"/>` +
    (pct > 0
      ? `<circle cx="50" cy="50" r="${R}" fill="none" stroke="${xmlEscape(accent)}" stroke-width="${STROKE}"` +
        ` stroke-linecap="round" pathLength="100" stroke-dasharray="${r2(pct)} ${r2(100 - pct)}"` +
        ` transform="rotate(-90 50 50)"/>`
      : '') +
    `</svg>`;
  return ring + progressLabel(el, pct, textColor, fontFamily);
}

const STAR_PATH =
  'M12 2.6l2.7 5.47 6.04.88-4.37 4.26 1.03 6.02L12 16.85 6.6 19.23l1.03-6.02L3.26 8.95l6.04-.88z';

/** A rating: five stars, the score's worth filled. */
export function svgRating(el: Data, accent: string): string {
  const score = clampRating(el.rating ?? RATING_DEFAULT);
  const star = Math.max(12, Math.min(el.height * 0.8, (el.width / RATING_MAX) * 0.86));
  const gap = star * 0.16;
  const rowW = RATING_MAX * star + (RATING_MAX - 1) * gap;
  const x0 = el.x + el.width / 2 - rowW / 2;
  const y0 = el.y + el.height / 2 - star / 2;
  return Array.from({ length: RATING_MAX }, (_, i) => {
    const filled = i < score;
    const x = x0 + i * (star + gap);
    const paint = filled
      ? ` fill="${xmlEscape(accent)}" stroke="${xmlEscape(accent)}" stroke-width="0"`
      : ` fill="none" stroke="${MUTED_RULE}" stroke-width="1.6"`;
    return (
      `<svg x="${r2(x)}" y="${r2(y0)}" width="${r2(star)}" height="${r2(star)}" viewBox="0 0 24 24" overflow="visible">` +
      `<path d="${STAR_PATH}"${paint} stroke-linejoin="round"/></svg>`
    );
  }).join('');
}
