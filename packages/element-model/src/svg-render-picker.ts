// The Picker at rest in the headless render (exports, the minimap, thumbnails): the canvas face's
// payline, header and Spin pill (or, on a compact card, the payline beside a round Spin) (docs/specs/012-collaboration/picker.md "The look"), laid out by the same
// pickerLayout the canvas uses, so an export stands where the canvas does. Shared by every product
// that has the picker.

import { inkOn } from './colour-math';
import { pickerCountText, pickerLayout, PICKER_HEADER, PICKER_ROUND_BUTTON } from './picker-layout';
import { r2, xmlEscape } from './svg-render-primitives';

export type PickerSvgInput = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  pickerSource?: 'participants' | 'options';
  pickerOptions?: string[];
  pickerResult?: string;
  pickerRemoveDrawn?: boolean;
  pickerDrawn?: string[];
};

const CHAR_EM = 0.56;
// The all-drawn line's height, as the canvas face sets it.
const CAPTION_H = 22;

function line(
  x: number,
  y: number,
  body: string,
  o: { size: number; weight: number; color: string; anchor?: 'middle' | 'end'; opacity?: number },
  extra = '',
): string {
  return (
    `<text x="${r2(x)}" y="${r2(y)}" font-size="${o.size}" font-weight="${o.weight}" fill="${xmlEscape(o.color)}"` +
    `${o.anchor ? ` text-anchor="${o.anchor}"` : ''}${o.opacity !== undefined ? ` opacity="${o.opacity}"` : ''}${extra}>` +
    `${xmlEscape(body)}</text>`
  );
}

function fit(body: string, width: number, size: number): string {
  const fits = Math.max(1, Math.floor(width / (size * CHAR_EM)));
  const flat = body.replace(/\s+/g, ' ').trim();
  return flat.length <= fits ? flat : `${flat.slice(0, Math.max(0, fits - 1)).trimEnd()}…`;
}

// The written options as the canvas reads them (trimmed, blanks out), and how many are left.
function optionCounts(el: PickerSvgInput) {
  const options = (el.pickerOptions ?? []).map((o) => o.trim()).filter((o) => o.length > 0);
  const listed = new Set(options);
  const drawn = el.pickerRemoveDrawn
    ? new Set((el.pickerDrawn ?? []).filter((d) => listed.has(d)))
    : new Set<string>();
  return { options, left: options.filter((o) => !drawn.has(o)).length };
}

// A name wrapped into at most `lines` lines of `perLine` characters, the last one cut if it still runs over.
function wrap(body: string, width: number, size: number, lines: number): string[] {
  const perLine = Math.max(1, Math.floor(width / (size * CHAR_EM)));
  const words = body.replace(/\s+/g, ' ').trim().split(' ');
  const out: string[] = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= perLine || !current) current = next;
    else {
      out.push(current);
      current = word;
    }
  }
  out.push(current);
  const kept = out.slice(0, lines);
  if (out.length > lines) kept[lines - 1] = `${kept[lines - 1]} ${out.slice(lines).join(' ')}`;
  return kept.map((l) => fit(l, width, size));
}

const SHUFFLE =
  '<path d="M2 18h1.4c1.3 0 2.5-.6 3.3-1.7l6.1-8.6c.7-1.1 2-1.7 3.3-1.7H22"/><path d="m18 2 4 4-4 4"/><path d="M2 6h1.9c1.5 0 2.9.9 3.6 2.2"/><path d="M22 18h-5.9c-1.3 0-2.6-.7-3.3-1.8l-.5-.8"/><path d="m18 14 4 4-4 4"/>';
const RESET = '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>';
const glyph = (x: number, y: number, ink: string, body: string) =>
  `<svg x="${r2(x)}" y="${r2(y)}" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${ink}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

export function svgPicker(
  el: PickerSvgInput,
  title: string,
  color: string,
  // The theme accent: the element's own stroke, or the Default scheme's for the paper.
  accent: string,
): string {
  const source = el.pickerSource ?? 'participants';
  const removeDrawn = el.pickerRemoveDrawn === true;
  const { options, left } = optionCounts(el);
  // A room's size is not in the stored element, so a people picker's export shows no count.
  const total = source === 'options' ? options.length : 0;
  const allDrawn = source === 'options' && removeDrawn && total > 0 && left === 0;
  const result = el.pickerResult;
  const longest = Math.max(result?.length ?? 0, ...options.map((o) => o.length));
  const layout = pickerLayout(el.width, el.height, { longest, caption: allDrawn });
  const a = xmlEscape(accent);
  const ink = xmlEscape(inkOn(accent));
  const word = allDrawn ? 'Reset' : result ? 'Spin Again' : 'Spin';
  let out = '';

  // The payline: the accent as a tinted band with a notch at each end, and the name on it.
  const payline = (bandX: number, bandY: number, bandW: number) => {
    const midY = bandY + layout.rowH / 2;
    out +=
      `<rect x="${r2(bandX)}" y="${r2(bandY)}" width="${r2(bandW)}" height="${r2(layout.rowH)}" rx="10" fill="${a}" fill-opacity="0.14" stroke="${a}" stroke-opacity="0.4"/>` +
      `<path d="M${r2(bandX + 4)} ${r2(midY - 5)}l6 5l-6 5z" fill="${a}"/>` +
      `<path d="M${r2(bandX + bandW - 4)} ${r2(midY - 5)}l-6 5l6 5z" fill="${a}"/>`;
    const name =
      layout.compact && allDrawn
        ? 'All drawn'
        : (result ?? (total === 0 && source === 'options' ? 'Nothing to pick from' : '?'));
    const size = result || name === '?' ? layout.nameSize : 13;
    const rows = wrap(name, bandW - (layout.compact ? 32 : 48), size, result ? layout.lines : 1);
    const lineH = size * 1.25;
    rows.forEach((row, i) => {
      const y = midY + (i - (rows.length - 1) / 2) * lineH + size * 0.35;
      out += line(bandX + bandW / 2, y, row, {
        size,
        weight: result ? 600 : 700,
        color,
        anchor: 'middle',
        opacity: result ? undefined : 0.62,
      });
    });
  };

  if (layout.compact) {
    // One row: the payline beside a round Spin (or Reset).
    const cy = el.y + el.height / 2;
    const bandX = el.x + 8;
    const bandW = el.width - 16 - PICKER_ROUND_BUTTON;
    payline(bandX, cy - layout.rowH / 2, bandW);
    const bx = bandX + bandW + 6 + 14;
    out +=
      `<circle cx="${r2(bx)}" cy="${r2(cy)}" r="14" fill="${a}"/>` +
      glyph(bx - 7, cy - 7, ink, allDrawn ? RESET : SHUFFLE);
    return out;
  }

  // The header, pinned to the top.
  const top = el.y + 8;
  const left0 = el.x + 12;
  const right0 = el.x + el.width - 12;
  const count = pickerCountText({ source, total, left, removeDrawn });
  const chipW = count ? count.length * 10 * CHAR_EM + 16 : 0;
  if (title) {
    out += line(left0, top + 12, fit(title.toUpperCase(), el.width - 32 - chipW, 10), {
      size: 10,
      weight: 600,
      color,
      opacity: 0.62,
    });
  }
  if (count) {
    out +=
      `<rect x="${r2(right0 - chipW)}" y="${r2(top)}" width="${r2(chipW)}" height="17" rx="8.5" fill="${xmlEscape(color)}" opacity="0.07"/>` +
      line(right0 - chipW / 2, top + 12, count, {
        size: 10,
        weight: 600,
        color,
        anchor: 'middle',
      });
  }

  // The Spin pill (Reset once a round is over) at the foot, the all-drawn line above it, and the reel
  // in the middle of what is left.
  const cx = el.x + el.width / 2;
  const pillY = el.y + el.height - 8 - 28;
  const captionH = layout.caption ? CAPTION_H : 0;
  const middleTop = top + PICKER_HEADER;
  const middleBottom = pillY - 6 - captionH;
  const bandY = (middleTop + middleBottom) / 2 - layout.rowH / 2;
  payline(el.x + 12, bandY, el.width - 24);
  if (layout.caption) {
    out += line(cx, pillY - 6 - captionH + 14, 'Every option is drawn', {
      size: 11,
      weight: 500,
      color,
      anchor: 'middle',
      opacity: 0.62,
    });
  }
  const pillW = word.length * 12 * CHAR_EM + 46;
  out +=
    `<rect x="${r2(cx - pillW / 2)}" y="${r2(pillY)}" width="${r2(pillW)}" height="28" rx="14" fill="${a}"/>` +
    glyph(cx - pillW / 2 + 13, pillY + 7, ink, allDrawn ? RESET : SHUFFLE) +
    line(cx + 9, pillY + 18, word, {
      size: 12,
      weight: 600,
      color: inkOn(accent),
      anchor: 'middle',
    });
  return out;
}
