// Telling an SVG apart (docs/specs/020-import-export/svg-import.md "Where an SVG comes in"): a file by its type or
// name, and pasted text by what it opens with once leading whitespace, an XML declaration, a doctype and comments
// are skipped. Scanned with indexOf; no regular expressions.

/** Whether a file is an SVG: typed `image/svg+xml`, or named `.svg`. */
export function isSvgFile(file: Pick<File, 'name' | 'type'>): boolean {
  return file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg');
}

// How far into pasted text the opening `<svg` is looked for.
const HEAD_LIMIT = 4096;

/** Whether pasted text is SVG markup. */
export function looksLikeSvgText(text: string): boolean {
  let i = 0;
  const end = Math.min(text.length, HEAD_LIMIT);
  while (i < end) {
    const c = text.charCodeAt(i);
    if (c === 32 || c === 9 || c === 10 || c === 13 || c === 0xfeff) {
      i++;
      continue;
    }
    if (
      text.startsWith('<?', i) ||
      text.startsWith('<!DOCTYPE', i) ||
      text.startsWith('<!doctype', i)
    ) {
      // A doctype's internal subset (`[ <!ENTITY ...> ]`) holds `>` of its own: it ends at `]>`.
      let close = text.indexOf('>', i);
      const subset = text.indexOf('[', i);
      if (subset >= 0 && close >= 0 && subset < close) {
        const subsetEnd = text.indexOf(']>', subset);
        close = subsetEnd < 0 ? -1 : subsetEnd + 1;
      }
      if (close < 0) return false;
      i = close + 1;
      continue;
    }
    if (text.startsWith('<!--', i)) {
      const close = text.indexOf('-->', i + 4);
      if (close < 0) return false;
      i = close + 3;
      continue;
    }
    if (!text.startsWith('<svg', i)) return false;
    const next = text[i + 4];
    return (
      next === '>' ||
      next === ' ' ||
      next === '\n' ||
      next === '\t' ||
      next === '\r' ||
      next === '/'
    );
  }
  return false;
}
