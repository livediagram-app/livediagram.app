// The Temperature check in the headless render (docs/specs/012-collaboration/temperature-check.md "The face"),
// drawn as the canvas's TemperatureFace draws it, on its five-column grid
// (up to 88px a column, 6px apart, centred): the faces as 60px buttons, a
// count over each capsule bar filling from the bottom in its hue, and the mood
// meter spanning the first column's centre to the last's, with the reading
// large under it and who it is from.

import {
  TEMPERATURE_COLORS,
  TEMPERATURE_FACE_MOUTHS,
  TEMPERATURE_VALUES,
  temperaturePosition,
} from './collab-shapes';
import { responseStats, responseTally } from './responses';
import { r2, xmlEscape } from './svg-render-primitives';
import { collabCard, moodFace, PAD_X, PAD_Y, text, type Face } from './svg-render-face-kit';
import { BODY_GAP, BODY_TOP, roundRect } from './svg-render-collab-parts';

const BUTTON_H = 60;
const METER_H = 40;

export function svgTemperature(el: Face, title: string, color: string): string {
  const tally = responseTally(el.responses, TEMPERATURE_VALUES);
  const stats = responseStats(el.responses);
  const answered = stats.count;
  return collabCard(
    el,
    title || 'How are we feeling?',
    answered ? `${answered} answered` : undefined,
    color,
    (w, h) => {
      const inner = w - PAD_X * 2;
      const gap = 6;
      const col = Math.min(88, (inner - gap * 4) / 5);
      const x0 = PAD_X + (inner - (col * 5 + gap * 4)) / 2;
      const colX = (i: number) => x0 + i * (col + gap);
      let out = TEMPERATURE_VALUES.map((value, i) => {
        const x = colX(i);
        return (
          roundRect(x, BODY_TOP, col, BUTTON_H, 12, color, 0.04, { color, opacity: 0.1 }) +
          moodFace(x + col / 2, BODY_TOP + 23, 26, i + 1, color, TEMPERATURE_FACE_MOUTHS) +
          text(x + col / 2, BODY_TOP + 50, value, {
            size: 12,
            weight: 700,
            color,
            anchor: 'middle',
          })
        );
      }).join('');

      // The bars fill the room between the buttons and the meter.
      const meterY = h - PAD_Y - METER_H;
      const barsTop = BODY_TOP + BUTTON_H + BODY_GAP;
      const barTop = barsTop + 14;
      const barH = Math.max(24, meterY - BODY_GAP - barTop);
      const peak = Math.max(1, ...tally);
      out += tally
        .map((count, i) => {
          const hue = TEMPERATURE_COLORS[i]!;
          const bw = Math.min(28, col);
          const x = colX(i) + (col - bw) / 2;
          const fill = count ? Math.max(10, (count / peak) * barH) : 0;
          const gid = `temp-bar-${xmlEscape(el.id)}-${i}`;
          return (
            text(colX(i) + col / 2, barsTop + 9, String(count), {
              size: 10,
              weight: 600,
              color,
              anchor: 'middle',
              opacity: count ? 0.8 : 0.3,
            }) +
            roundRect(x, barTop, bw, barH, bw / 2, color, 0.06) +
            (fill
              ? `<defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${hue}"/><stop offset="1" stop-color="${hue}" stop-opacity="0.75"/></linearGradient></defs>` +
                `<rect x="${r2(x)}" y="${r2(barTop + barH - fill)}" width="${r2(bw)}" height="${r2(fill)}" rx="${r2(Math.min(bw / 2, fill / 2))}" fill="url(#${gid})"/>`
              : '')
          );
        })
        .join('');

      // The meter, from the first column's centre to the last's.
      const mx0 = colX(0) + col / 2;
      const mx1 = colX(4) + col / 2;
      const stops = TEMPERATURE_COLORS.map(
        (c, i) => `<stop offset="${i * 25}%" stop-color="${c}"/>`,
      ).join('');
      const gid = `temp-${xmlEscape(el.id)}`;
      out +=
        `<defs><linearGradient id="${gid}">${stops}</linearGradient></defs>` +
        `<rect x="${r2(mx0)}" y="${r2(meterY)}" width="${r2(mx1 - mx0)}" height="10" rx="5" fill="url(#${gid})" opacity="${answered ? 0.9 : 0.25}"/>`;
      if (stats.average === null || answered === 0) {
        return (
          out +
          text(PAD_X, meterY + 36, 'No readings yet', { size: 12.5, weight: 600, color }) +
          text(PAD_X + 104, meterY + 36, 'Tap the face that fits.', {
            size: 11,
            color,
            opacity: 0.55,
          })
        );
      }
      const pos = temperaturePosition(stats.average);
      const hue = TEMPERATURE_COLORS[Math.round(pos * 4)]!;
      const mx = mx0 + pos * (mx1 - mx0);
      return (
        out +
        `<circle cx="${r2(mx)}" cy="${r2(meterY + 5)}" r="12" fill="${hue}" fill-opacity="0.25"/>` +
        `<circle cx="${r2(mx)}" cy="${r2(meterY + 5)}" r="6.5" fill="#ffffff" stroke="${hue}" stroke-width="3"/>` +
        text(PAD_X, meterY + 40, stats.average.toFixed(1), { size: 22, weight: 700, color }) +
        text(w - PAD_X, meterY + 40, `from ${answered} ${answered === 1 ? 'person' : 'people'}`, {
          size: 10.5,
          color,
          anchor: 'end',
          opacity: 0.55,
        })
      );
    },
  );
}
