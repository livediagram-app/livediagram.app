// How user-authored text reaches a view line (docs/specs/024-agents/blueprints/document-views.md "The
// outline grammar"): every string goes through one of these, so no content can start a line, fake a
// header or break a line's grammar (I4).
import { ATTR_BARE_PATTERN } from './constants';

const WHITESPACE = /\s/u;
export const ELLIPSIS = '…';

// The first `max` code points, pulled back to the last whitespace when that splits a word.
export function cutAtWord(text: string, max: number): { kept: string; cut: boolean } {
  const points = Array.from(text);
  if (points.length <= max) return { kept: text, cut: false };
  let slice = points.slice(0, max);
  const next = points[max]!;
  if (!WHITESPACE.test(next)) {
    const lastSpace = slice.findLastIndex((p) => WHITESPACE.test(p));
    if (lastSpace > 0) slice = slice.slice(0, lastSpace);
  }
  return { kept: slice.join('').trimEnd(), cut: true };
}

// A JSON string, cut at `max` code points when given, `…` after the closing quote.
export function jsonString(text: string, max?: number): string {
  if (max === undefined) return JSON.stringify(text);
  const { kept, cut } = cutAtWord(text, max);
  return `${JSON.stringify(kept)}${cut ? ELLIPSIS : ''}`;
}

// Bare when URL-safe without spaces or quotes, else a JSON string (VW15).
export function attrValue(text: string): string {
  return ATTR_BARE_PATTERN.test(text) ? text : JSON.stringify(text);
}

// A table cell or entity field: JSON escapes without the quotes, `|` escaped; inside entity braces `;`
// and `}` too.
export function cellText(text: string, inEntity = false): string {
  const escaped = JSON.stringify(text).slice(1, -1).replace(/\|/g, '\\|');
  return inEntity ? escaped.replace(/;/g, '\\;').replace(/\}/g, '\\}') : escaped;
}

// `1 element`, `2 elements`.
export function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}
