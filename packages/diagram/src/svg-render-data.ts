// Data elements in the headless render (docs/specs/009-elements/progress.md, /51, /52, /100, /120):
// progress bars and rings, ratings, timeline rails, record boxes and a page's
// masthead.
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

import { clampPercent, clampRating, RATING_DEFAULT, RATING_MAX } from './data-shapes';
import { RAIL_DEFAULT_POINTS } from './data-shapes';
import { labelFontPx } from './label-font';
import type { BoxedElement } from './index';
import { r2, xmlEscape } from './svg-render-primitives';

type Data = BoxedElement & { type: 'shape' };

const MUTED_RULE = '#cbd5e1';
const RAIL_LINE = '#94a3b8';

const sans = (fontFamily?: string) =>
  ` font-family="${xmlEscape(fontFamily ?? 'system-ui, sans-serif')}"`;

/** The centred percentage every progress element carries. */
function progressLabel(el: Data, pct: number, textColor: string, fontFamily?: string): string {
  return (
    `<text x="${r2(el.x + el.width / 2)}" y="${r2(el.y + el.height / 2)}" text-anchor="middle"` +
    ` dominant-baseline="central"${sans(fontFamily)} font-size="14" font-weight="600"` +
    ` fill="${xmlEscape(textColor)}">${pct}%</text>`
  );
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
    `<rect x="${r2(el.x)}" y="${r2(el.y)}" width="${r2(el.width)}" height="${r2(el.height)}" rx="${r2(r)}" fill="${xmlEscape(track)}"/>` +
    (fillW > 0
      ? `<rect x="${r2(el.x)}" y="${r2(el.y)}" width="${r2(fillW)}" height="${r2(el.height)}" rx="${r2(r)}" fill="${xmlEscape(accent)}"/>`
      : '') +
    progressLabel(el, pct, textColor, fontFamily)
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

/** A timeline rail: the line, its evenly spaced points, and their labels. */
export function svgTimelineRail(
  el: Data,
  accent: string,
  textColor: string,
  fontFamily?: string,
): string {
  const w = Math.max(1, el.width);
  const h = Math.max(1, el.height);
  const count = Math.max(1, Math.round(el.railCount ?? RAIL_DEFAULT_POINTS));
  const labels = el.railLabels ?? [];
  const padX = Math.min(44, w * 0.12);
  const labelTop = h * 0.06;
  const labelH = h * 0.36;
  const dotY = h * 0.58;
  const lineY = h * 0.82;
  const r = Math.max(5, Math.min(9, h * 0.1));
  const fontSize = Math.max(10, Math.min(16, h * 0.16));
  const xs =
    count <= 1
      ? [(padX + (w - padX)) / 2]
      : Array.from({ length: count }, (_, i) => padX + ((w - 2 * padX) * i) / (count - 1));
  const line = `<path d="M ${r2(el.x + padX)} ${r2(el.y + lineY)} L ${r2(el.x + w - padX)} ${r2(el.y + lineY)}" stroke="${RAIL_LINE}" stroke-width="2" stroke-linecap="round"/>`;
  const points = xs
    .map((x, i) => {
      const cx = el.x + x;
      const stem = `<path d="M ${r2(cx)} ${r2(el.y + dotY + r)} L ${r2(cx)} ${r2(el.y + lineY)}" stroke="${MUTED_RULE}" stroke-width="1.5"/>`;
      const dot = `<circle cx="${r2(cx)}" cy="${r2(el.y + dotY)}" r="${r2(r)}" fill="${xmlEscape(accent)}"/>`;
      const text = labels[i];
      // The label sits in its slot above the dot, bottom-aligned against it,
      // which is what `items-end` does on the canvas.
      const caption = text
        ? `<text x="${r2(cx)}" y="${r2(el.y + labelTop + labelH)}" text-anchor="middle"${sans(fontFamily)}` +
          ` font-size="${r2(fontSize)}" font-weight="500" fill="${xmlEscape(textColor)}">${xmlEscape(text)}</text>`
        : '';
      return stem + dot + caption;
    })
    .join('');
  return line + points;
}

/**
 * A record's header rule + field rows (docs/specs/009-elements/entity.md).
 *
 * The TITLE is the element's ordinary label, so the generic label emitter
 * still draws it; this is the rule under it and the rows below.
 */
export function svgEntityRows(el: Data, textColor: string, fontFamily?: string): string {
  const rule = el.strokeColor ?? MUTED_RULE;
  // The same header height the canvas computes: the label's px times its line
  // height, plus its vertical padding, floored at the historical 30.
  const headerH = Math.max(30, Math.round(labelFontPx(el.textSize ?? 'scale') * 1.25) + 10);
  const divider = `<path d="M ${r2(el.x)} ${r2(el.y + headerH)} L ${r2(el.x + el.width)} ${r2(el.y + headerH)}" stroke="${xmlEscape(rule)}" stroke-width="1"/>`;
  const fields = el.entityFields ?? [];
  const rowH = 11 * 1.25 + 3;
  const top = el.y + headerH + 6;
  const rows = fields
    .map((f, i) => {
      const y = top + i * rowH + 8;
      if (y > el.y + el.height - 2) return '';
      const name = `<text x="${r2(el.x + 8)}" y="${r2(y)}"${sans(fontFamily)} font-size="11" fill="${xmlEscape(textColor)}">${xmlEscape(f.name)}</text>`;
      // The type is muted and pushed right: scanning a class is scanning the
      // NAMES, and a full-strength type column competes with them.
      const type = f.type
        ? `<text x="${r2(el.x + el.width - 8)}" y="${r2(y)}" text-anchor="end"${sans(fontFamily)} font-size="10" opacity="0.55" fill="${xmlEscape(textColor)}">${xmlEscape(f.type)}</text>`
        : '';
      return name + type;
    })
    .join('');
  return divider + rows;
}

/** A page's masthead (docs/specs/009-elements/page-element.md): title, subtitle and the rule under them. */
export function svgPageMasthead(el: Data, padding: number, fontFamily?: string): string {
  const title = el.pageTitle ?? '';
  const subtitle = el.pageSubtitle ?? '';
  const x = el.x + padding;
  const rule = el.strokeColor ?? '#d4d4d8';
  const titleY = el.y + padding + 19;
  const subtitleY = titleY + 16;
  const parts: string[] = [];
  if (title)
    parts.push(
      `<text x="${r2(x)}" y="${r2(titleY)}"${sans(fontFamily)} font-size="19" font-weight="600" fill="#0f172a">${xmlEscape(title)}</text>`,
    );
  if (subtitle)
    parts.push(
      `<text x="${r2(x)}" y="${r2(subtitleY)}"${sans(fontFamily)} font-size="12" font-weight="500" fill="#64748b">${xmlEscape(subtitle)}</text>`,
    );
  const ruleY = subtitleY + 10;
  parts.push(
    `<path d="M ${r2(x)} ${r2(ruleY)} L ${r2(el.x + el.width - padding)} ${r2(ruleY)}" stroke="${xmlEscape(rule)}" stroke-width="1"/>`,
  );
  return parts.join('');
}
