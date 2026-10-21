// A label as a message quotes it (blueprint N19, LN21): C0 and C1 controls stripped, whitespace collapsed,
// cut at LINT_LABEL_QUOTE_MAX characters with `…`, JSON-escaped, so no label reaches a terminal raw.

import { LINT_LABEL_QUOTE_MAX } from './constants';

const isControl = (code: number) => code < 0x20 || (code >= 0x7f && code <= 0x9f);

export function quoteLabel(label: string): string {
  const visible = [...label].map((ch) => (isControl(ch.codePointAt(0)!) ? ' ' : ch)).join('');
  const clean = visible.replace(/\s+/g, ' ').trim();
  const chars = [...clean];
  const cut =
    chars.length > LINT_LABEL_QUOTE_MAX
      ? `${chars
          .slice(0, LINT_LABEL_QUOTE_MAX - 1)
          .join('')
          .trimEnd()}…`
      : clean;
  return JSON.stringify(cut);
}
