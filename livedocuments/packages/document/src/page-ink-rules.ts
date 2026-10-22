// Which colours of an element re-inking measures, and how (docs/specs/007-editor/
// pages-mode.md "Re-inking"): the floors and targets of text, lines, marks and cards, the
// shape kinds each rule reaches, and the elements left as they are. Pure.
import { isLegacyEmojiIconId, isTechIconId } from '@livedocuments/icons';
import { defaultFillColor, defaultStrokeColor, type CanvasSurface } from './colors';
import { isOpaqueHex } from './page-ink-contrast';
import type { BoxedElement, Element } from './index';

// The least contrast `legibleOn` keeps a colour at by default (an article's accent): WCAG 2.2
// SC 1.4.3 large text. Re-inking holds a page's text to AA instead (PAGE_INK_CONTRAST).
export const PAGE_INK_FLOOR = 3;
// Text on a page is re-inked below this, a soft heading included: on a new fill every word reads
// at least at AA. WCAG 2.2 SC 1.4.3 AA.
export const PAGE_INK_CONTRAST = 4.5;
// What re-inked text reaches: WCAG 2.2 SC 1.4.6 AAA. The least change that only just makes AA
// leaves a dark heading a muddy mid grey on a dark page (#0f172a on #1c1917 lands on #7d828c);
// at 7:1 it reads plainly (#a1a4ab) and keeps its hue. Safe range 4.5 to 10: past 10 coloured text
// turns pastel.
export const PAGE_INK_TARGET = 7;
// Lines, glyphs and marks: floor and target both. WCAG 2.2 SC 1.4.11 non-text contrast.
export const PAGE_LINE_CONTRAST = 3;
// A card's fill against its ground: below the floor a white card on a near-white page stops
// reading as a card; re-inked, it reaches the target, a step past the floor so it reads plainly.
// Safe range 1.1 to 1.5: lower lets cards vanish, higher greys out every pale card on a pale page.
const PAGE_CARD_FLOOR = 1.25;
const PAGE_CARD_TARGET = 1.4;

export type InkRole = 'text' | 'line' | 'mark' | 'card';

export const INK_ROLE_CONTRAST: Record<InkRole, { floor: number; target: number }> = {
  text: { floor: PAGE_INK_CONTRAST, target: PAGE_INK_TARGET },
  line: { floor: PAGE_LINE_CONTRAST, target: PAGE_LINE_CONTRAST },
  mark: { floor: PAGE_LINE_CONTRAST, target: PAGE_LINE_CONTRAST },
  card: { floor: PAGE_CARD_FLOOR, target: PAGE_CARD_TARGET },
};

// The colour fields re-inking may write.
export type InkField =
  'fillColor' | 'strokeColor' | 'textColor' | 'arrowheadColor' | 'headerTextColor';

// Shapes that are a box: a fill (when they have one) under a label, a border round it.
const BOX_KINDS = new Set<string>([
  'square',
  'circle',
  'diamond',
  'cylinder',
  'parallelogram',
  'hexagon',
  'document',
  'page',
  'callout',
  'card',
  'stadium',
  'cloud',
  'triangle',
  'trapezoid',
  'star',
  'speech-bubble',
  'frame',
  'foldable',
]);
// Shapes drawn straight onto what they sit on, in their stroke (the accent) and text colours.
const ACCENT_INK_KINDS = new Set<string>([
  'icon',
  'progress-bar',
  'progress-ring',
  'timeline-rail',
  'rating',
  // A process's step discs and connectors are its stroke, its captions its text, on the page.
  'process',
]);
// Charts: their text is ink on the page; their series keep the palette (its colours are its
// meaning).
const CHART_KINDS = new Set<string>(['pie-chart', 'bar-chart', 'line-chart', 'sankey']);

/** How re-inking treats an element:
 *  - `box`: a fill under a label (a shape box, a closed filled path or sketch, an annotation);
 *  - `ink`: lines and text straight on its ground (text, arrows, open paths, icons, charts);
 *  - `table`: its grid and text;
 *  - `keep`: left as it is (its colours are what it is, its text on its own surface). */
type InkKind = 'box' | 'ink' | 'table' | 'keep';

export function inkKindOf(el: Element): InkKind {
  switch (el.type) {
    case 'text':
    case 'arrow':
      return 'ink';
    case 'table':
      return 'table';
    case 'annotation':
      return 'box';
    case 'freehand':
      if (el.pen === 'highlighter') return 'keep';
      return el.closed ? 'box' : 'ink';
    case 'shape':
      // A stat row's cards are its fill, its figures its stroke and its captions its text, on them.
      if (BOX_KINDS.has(el.shape) || el.shape === 'stat-row') return 'box';
      if (el.shape === 'icon') {
        // A Technology mark and an emoji draw their own colours; the stroke does not reach them.
        return isTechIconId(el.iconId) || isLegacyEmojiIconId(el.iconId) ? 'keep' : 'ink';
      }
      if (ACCENT_INK_KINDS.has(el.shape) || CHART_KINDS.has(el.shape)) return 'ink';
      return 'keep';
    default:
      return 'keep';
  }
}

/** Whether an element's stroke is ink re-inking measures (a chart's is not: its series are). */
export function hasInkStroke(el: Element): boolean {
  return !(el.type === 'shape' && CHART_KINDS.has(el.shape));
}

/** What an element left as it is does to anything drawn over it: `null` hides the page behind a
 *  surface of its own whose tone is not known (a picture, a widget), so what is on it is left
 *  alone; a tone is a known surface (a sticky note's paper, a link card's); `undefined` covers
 *  nothing. */
export function keptCover(el: Element, surface: CanvasSurface): string | null | undefined {
  if (el.type === 'sticky' || el.type === 'link-card') {
    const fill = el.fillColor ?? defaultFillColor(el, surface);
    return isOpaqueHex(fill) ? fill : null;
  }
  if (el.type === 'image' || el.type === 'video') return null;
  if (el.type === 'shape') {
    if (el.shape === 'icon') return undefined;
    return null;
  }
  return undefined;
}

/** The fill a box draws: its own, else its default on this surface; null when it draws none
 *  (transparent, an open path, a colour re-inking cannot read). */
export function boxFill(el: BoxedElement, surface: CanvasSurface): string | null {
  const fill = el.fillColor ?? defaultFillColor(el, surface);
  return isOpaqueHex(fill) ? fill : null;
}

/** The border a box draws round its fill, or null when it draws none. */
export function boxBorder(el: BoxedElement, surface: CanvasSurface): string | null {
  if ('strokeWidth' in el && el.strokeWidth === 'none') return null;
  const stroke = el.strokeColor ?? defaultStrokeColor(el, surface);
  return isOpaqueHex(stroke) ? stroke : null;
}

/** Whether an element carries a label of its own. */
export function hasLabel(el: Element): boolean {
  return (
    typeof (el as { label?: unknown }).label === 'string' &&
    (el as { label: string }).label.trim() !== ''
  );
}
