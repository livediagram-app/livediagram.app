// A Visio shape's words and how they are set (docs/specs/020-import-export/visio-import.md "Properties"): the
// `<Text>` element's text, fields' shown values included, and the first character run's and first paragraph's
// formatting as draw.io style pairs.

import { VISIO_MAX_TEXT, VISIO_PX_PER_INCH } from './limits';
import { finite, visioColour, type ShapeSheet } from './sheet';

export type StylePairs = Record<string, string>;

const LINE_BREAKS = new Set(['\r', ' ', ' ', '\u000b']);

/** The shape's text, line breaks as `\n`, trailing breaks dropped, cut at `VISIO_MAX_TEXT`. */
export function shapeText(sheet: ShapeSheet): { text: string; truncated: boolean } {
  const whole = sheet.text()?.textContent ?? '';
  // Twice the cap leaves room for trailing breaks and CRLF pairs; anything past it is cut regardless.
  const raw = whole.slice(0, VISIO_MAX_TEXT * 2);
  const chars: string[] = [];
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i]!;
    if (ch === '\r' && raw[i + 1] === '\n') continue;
    chars.push(LINE_BREAKS.has(ch) ? '\n' : ch);
  }
  let end = chars.length;
  while (end > 0 && (chars[end - 1] === '\n' || chars[end - 1] === ' ')) end--;
  const text = chars.slice(0, end).join('');
  if (text.length <= VISIO_MAX_TEXT && raw.length === whole.length)
    return { text, truncated: false };
  return { text: text.slice(0, VISIO_MAX_TEXT), truncated: true };
}

const ALIGN: Record<string, string> = {
  '0': 'left',
  '1': 'center',
  '2': 'right',
  '3': 'left',
  '4': 'left',
};
const VERTICAL: Record<string, string> = { '0': 'top', '1': 'middle', '2': 'bottom' };

/** A style value draw.io's style string can carry: no pair or name separator in it. */
export const safeValue = (value: string) => !value.includes(';') && !value.includes('=');

/** The draw.io style pairs of a shape's text: size, colour, bold / italic / underline / strike, face, alignment. */
export function textStyle(sheet: ShapeSheet, colours: ReadonlyMap<number, string>): StylePairs {
  const pairs: StylePairs = {
    align: ALIGN[sheet.row('Paragraph', '0', 'HorzAlign') ?? '1'] ?? 'center',
    verticalAlign: VERTICAL[sheet.cell('VerticalAlign') ?? '1'] ?? 'middle',
  };
  const size = finite(sheet.row('Character', '0', 'Size'));
  if (size !== undefined && size > 0)
    pairs.fontSize = String(Math.round(size * VISIO_PX_PER_INCH * 10) / 10);
  const colour = visioColour(sheet.row('Character', '0', 'Color'), colours);
  if (colour) pairs.fontColor = colour;
  const bits = finite(sheet.row('Character', '0', 'Style')) ?? 0;
  const strike = sheet.row('Character', '0', 'Strikethru') === '1' ? 8 : 0;
  const fontStyle = (Number.isInteger(bits) ? bits & 7 : 0) | strike;
  if (fontStyle !== 0) pairs.fontStyle = String(fontStyle);
  const font = sheet.row('Character', '0', 'Font')?.trim();
  if (font && font !== 'Themed' && finite(font) === undefined && safeValue(font))
    pairs.fontFamily = font;
  return pairs;
}
