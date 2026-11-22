// How an article's blocks are set and wrapped when laid out without a browser (article-layout-estimate.ts): each
// block's size, weight, face and margins as app/article-pages.css sets it, and its words wrapped at an estimated
// width. Split out of article-layout-estimate.ts, which re-exports BOLD_EM and wrapEstimated.

import type { ArticleBlock, ArticleRun } from './article-flow';

// An average glyph's advance as a share of the font size (a bold one a little wider), as the headless renders
// estimate a label (svg-render-primitives' LABEL_ESTIMATE_CHAR_EM).
export const CHAR_EM = 0.52;
export const BOLD_EM = 1.06;
export const MONO = 'Roboto Mono, ui-monospace, monospace';

// How a block is set (app/article-pages.css): its size as a share of the body size, weight, face, line height (null:
// the body's), margins above and below in body lines, its left indent in px, and its colour.
export type Set = {
  scale: number;
  weight: string;
  italic?: boolean;
  heading?: boolean;
  mono?: boolean;
  leading: number | null;
  above: number;
  below: number;
  indent: number;
  muted?: boolean;
  ruled?: boolean;
};

export function setOf(b: ArticleBlock, para: number, rules: 'none' | 'title' | 'headings'): Set {
  const head = (
    scale: number,
    weight: string,
    above: number,
    below: number,
    leading = 1.25,
  ): Set => ({
    scale,
    weight,
    heading: true,
    leading,
    above,
    below,
    indent: 0,
  });
  if (b.type === 'list')
    return {
      scale: 1,
      weight: '400',
      leading: null,
      above: 0,
      below: 0.25,
      indent: 28 * ((b.level ?? 0) + 1),
    };
  if (b.type === 'code')
    return {
      scale: 14 / 16,
      weight: '400',
      mono: true,
      leading: 1.55,
      above: 0.5,
      below: 0.75,
      indent: 14,
    };
  if (b.type !== 'paragraph')
    return { scale: 1, weight: '400', leading: null, above: 0, below: 0, indent: 0 };
  switch (b.style) {
    case 'title':
      return { ...head(36 / 16, '700', 0, 0.5, 1.15), ruled: rules !== 'none' };
    case 'subtitle':
      return {
        scale: 20 / 16,
        weight: '400',
        leading: null,
        above: 0,
        below: 1,
        indent: 0,
        muted: true,
      };
    case 'h1':
      return { ...head(28 / 16, '700', 1.2, 0.4), ruled: rules === 'headings' };
    case 'h2':
      return { ...head(22 / 16, '650', 1, 0.3), ruled: rules === 'headings' };
    case 'h3':
      return { ...head(18 / 16, '650', 0.8, 0.2), ruled: rules === 'headings' };
    case 'quote':
      return {
        scale: 18 / 16,
        weight: '400',
        italic: true,
        leading: null,
        above: 0.5,
        below: 0.75,
        indent: 16,
      };
    default:
      return { scale: 1, weight: '400', leading: null, above: 0, below: para, indent: 0 };
  }
}

export const runsText = (runs: readonly ArticleRun[]) => runs.map((r) => r.text).join('');

// A stretch of a line in one style.
export type Style = { b: boolean; i: boolean };
export type Segment = Style & { text: string };

// Each character's style, from the runs it is in (a block set bold, a heading, bolds every character).
export function charStyles(runs: readonly ArticleRun[], bold: boolean, italic: boolean): Style[] {
  return runs.flatMap((r) => Array.from(r.text, () => ({ b: bold || !!r.b, i: italic || !!r.i })));
}

// A wrapped line cut where its style changes, found in the block's text from `from`; the end it reached.
export function segmentsOf(
  text: string,
  styles: readonly Style[],
  line: string,
  from: number,
): { segments: Segment[]; end: number } {
  const at = line ? text.indexOf(line, from) : from;
  const start = at < 0 ? from : at;
  const segments: Segment[] = [];
  for (let k = 0; k < line.length; k++) {
    const s = styles[start + k] ?? { b: false, i: false };
    const last = segments[segments.length - 1];
    if (last && last.b === s.b && last.i === s.i) last.text += line[k];
    else segments.push({ ...s, text: line[k]! });
  }
  return { segments, end: start + line.length };
}

// The lines a text breaks into at `width` px, words kept whole unless one alone is wider.
export function wrapEstimated(text: string, width: number, px: number, bold: boolean): string[] {
  const advance = px * CHAR_EM * (bold ? BOLD_EM : 1);
  const fits = Math.max(1, Math.floor(width / advance));
  const out: string[] = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (const word of para.split(/ +/)) {
      const next = line ? `${line} ${word}` : word;
      if (next.length <= fits) {
        line = next;
        continue;
      }
      if (line) out.push(line);
      let rest = word;
      while (rest.length > fits) {
        out.push(rest.slice(0, fits));
        rest = rest.slice(fits);
      }
      line = rest;
    }
    out.push(line);
  }
  return out;
}
