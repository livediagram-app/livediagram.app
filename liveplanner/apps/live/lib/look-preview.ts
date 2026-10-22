// A look's card preview (docs/specs/011-theme/canvas-and-theme-dialog.md "Looks"): a small sample board (three columns
// of cards) with the look applied (theme colours, finish, font, canvas colour and pattern), drawn by the tab exporter
// so the card shows the look's colours and finish. Several cards share one page, so the exporter's fixed pattern id is
// made unique per look.
import type { Element, ShapeElement, Tab, TextElement } from '@liveplanner/project';
import { animatedPatternStill } from '@/lib/animated-pattern-still';
import { EXPORT_PATTERN_COLOR, renderTabToSvg } from '@/lib/export-tab';
import { withLookApplied, type TabLook } from '@/lib/tab-looks';

const EXPORT_PATTERN_ID = 'lvd-export-bg';

// The sample board: a column heading over each column's cards. Fixed ids, so the Sketch wobble is the same every
// time. Each card is a loose box, so a multi-colour theme gives each the next colour of its palette, and a
// single-colour theme paints them all alike.
const COLUMN_W = 150;
const COLUMN_GAP = 20;
const CARD_H = 46;
const CARD_GAP = 12;
const HEADING_H = 26;
const COLUMNS: readonly { name: string; cards: readonly string[] }[] = [
  { name: 'To do', cards: ['Plan work', 'Write brief'] },
  { name: 'Doing', cards: ['Review'] },
  { name: 'Done', cards: ['Ship it'] },
];

export const LOOK_PREVIEW_ELEMENTS: readonly Element[] = COLUMNS.flatMap((column, c) => {
  const x = c * (COLUMN_W + COLUMN_GAP);
  const heading: TextElement = {
    id: `look-preview-column-${c}`,
    type: 'text',
    x,
    y: 0,
    width: COLUMN_W,
    height: HEADING_H,
    label: column.name,
    textAlignX: 'left',
  };
  const cards = column.cards.map((label, i): ShapeElement => ({
    id: `look-preview-card-${c}-${i}`,
    type: 'shape',
    shape: 'square',
    x,
    y: HEADING_H + CARD_GAP + i * (CARD_H + CARD_GAP),
    width: COLUMN_W,
    height: CARD_H,
    label,
  }));
  return [heading, ...cards];
});

/** The sample board with the look applied, as a tab of its own. */
export function lookPreviewTab(look: TabLook): Tab {
  const blank = {
    id: `look-${look.id}`,
    name: look.label,
    elements: [...LOOK_PREVIEW_ELEMENTS],
  } as Tab;
  return withLookApplied(blank, look);
}

/** The look's card preview as SVG markup, its ids scoped to the look. */
export function lookPreviewSvg(look: TabLook): string {
  const tab = lookPreviewTab(look);
  const svg = withAnimatedStill(renderTabToSvg(tab), tab, `lvd-look-${look.id}`);
  return svg.split(EXPORT_PATTERN_ID).join(`lvd-look-${look.id}-bg`);
}

// The exporter paints no image for an animated backdrop (a download has no motion), so a card would show bare paper
// for Northern Lights' aurora or Lagoon's ripples. The card lays the motif's still frame over its paper instead: just
// after the exporter's first rect, which is the paper filling the view box.
const VIEW_BOX = /viewBox="(-?[\d.]+) (-?[\d.]+) ([\d.]+) ([\d.]+)"/;

// The first self-closing `<rect .../>`, found in one pass. A regex for it backtracks on a run of unclosed
// `<rect ` (CodeQL js/polynomial-redos); every start before a `>` ends at that same `>`, so the scan jumps past it.
export function firstSelfClosingRect(svg: string): { index: number; length: number } | null {
  let from = 0;
  for (;;) {
    const start = svg.indexOf('<rect ', from);
    if (start < 0) return null;
    const end = svg.indexOf('>', start);
    if (end < 0) return null;
    if (end - 1 >= start + 6 && svg[end - 1] === '/')
      return { index: start, length: end + 1 - start };
    from = end + 1;
  }
}

function withAnimatedStill(svg: string, tab: Tab, idPrefix: string): string {
  const box = VIEW_BOX.exec(svg);
  const paper = firstSelfClosingRect(svg);
  if (!box || !paper || !tab.backgroundPattern) return svg;
  const [x, y, w, h] = box.slice(1).map(Number) as [number, number, number, number];
  const still = animatedPatternStill(
    tab.backgroundPattern,
    tab.patternColor ?? EXPORT_PATTERN_COLOR,
    { x, y, w, h },
    idPrefix,
    tab.backgroundPatternScale ?? 1,
  );
  if (!still) return svg;
  const at = paper.index + paper.length;
  const opacity = tab.backgroundOpacity ?? 1;
  const layer = opacity < 1 ? `<g opacity="${opacity}">${still}</g>` : still;
  return svg.slice(0, at) + layer + svg.slice(at);
}
