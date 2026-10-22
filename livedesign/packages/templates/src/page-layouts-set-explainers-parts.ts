// Parts the Explainers layouts share (docs/specs/007-editor/pages-mode.md "Layouts"): the
// room a source line takes, a heading that keeps its lead line only where the page has height to
// spare, a leader line, a section's label over its accent rule, and the page type a line of words
// fits in.
import {
  createPinnedArrow,
  LABEL_FONT_PX,
  type Anchor,
  type ArrowElement,
  type Element,
  type TextElement,
} from '@livepages/document';
import { heading, type Kit } from './page-layout-kit';
import { SOURCE_H } from './page-layout-parts';

// The room a source line takes at the page's foot, with the gap above it (in u).
export const FOOT = SOURCE_H + 4;

// Taller than this many times its width, a page keeps a heading's lead line; a square or wide one
// spends that height on the content instead.
const LEAD_RATIO = 1.2;

export function explainerHeading(k: Kit, title: string, lead: string) {
  return k.box.height > k.box.width * LEAD_RATIO ? heading(k, title, lead) : heading(k, title);
}

// A leader line: a pinned arrow with no arrowhead, from a label to the spot it names.
export function leader(fromId: string, from: Anchor, toId: string, to: Anchor): ArrowElement {
  return { ...createPinnedArrow(fromId, from, toId, to), arrowEnds: 'none' };
}

// A section's name in bold page type over a short accent rule; `top` is where its content starts.
export function section(
  k: Kit,
  x: number,
  y: number,
  w: number,
  label: string,
): { els: Element[]; top: number } {
  const { u } = k;
  return {
    els: [
      k.text(x, y, w, u * 7, label, { textSize: 'lg', textBold: true }),
      k.shape('square', x, y + u * 7.5, u * 10, u * 1, { label: '', borderRadius: 'full' }),
    ],
    top: y + u * 11,
  };
}

// A bold glyph's mean advance as a share of its size: generous, so a line judged to fit never
// wraps.
const GLYPH_WIDTH = 0.6;

// The largest page type ('lg', else 'md') that sets every one of `lines` on one line `w` wide.
export function sizeToFit(w: number, lines: readonly string[]): TextElement['textSize'] {
  const longest = Math.max(...lines.map((l) => l.length));
  return longest * LABEL_FONT_PX.lg * GLYPH_WIDTH <= w ? 'lg' : 'md';
}
