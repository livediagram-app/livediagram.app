// A look's card preview (docs/specs/011-theme/canvas-and-theme-dialog.md "Looks"): the Finish preview's sample
// diagram with the look applied (theme colours, finish, font, canvas colour and pattern), drawn by the tab exporter so
// the card shows exactly what the tab will. Several cards share one page, so the exporter's fixed pattern id is made
// unique per look.
import type { ArrowElement, Element, Tab } from '@liveplanner/project';
import { animatedPatternStill } from '@/lib/animated-pattern-still';
import { EXPORT_PATTERN_COLOR, renderTabToSvg } from '@/lib/export-tab';
import { FINISH_PREVIEW_ELEMENTS } from '@/lib/finish-preview';
import { withLookApplied, type TabLook } from '@/lib/tab-looks';

const EXPORT_PATTERN_ID = 'lvd-export-bg';

// The colouring pass. A multi-colour theme colours by branch: with the arrow pinned, the step is the root (the
// theme's neutral) and only the decision takes a palette colour. So the pass runs on the sample with the arrow
// unpinned at the points its pins draw (the step's east edge, the decision's west tip), making each box a loose
// branch, and with PALETTE_SKIP unseen boxes between them, so the step takes the palette's first colour and the
// decision its fourth: across the wheel (Rainbow's red and green, Tropical's teal and orange) rather than two
// neighbours. A single-colour or per-shape theme paints the sample the same either way.
const PALETTE_SKIP = 2;
const SPACER_ID = 'look-preview-spacer-';

function colouringSample(): Element[] {
  const byId = new Map(FINISH_PREVIEW_ELEMENTS.map((el) => [el.id, el]));
  const edge = (end: ArrowElement['from']) => {
    if (end.kind !== 'pinned') return end;
    const el = byId.get(end.elementId) as { x: number; y: number; width: number; height: number };
    const y = el.y + el.height / 2;
    return { kind: 'free' as const, x: end.anchor === 'e' ? el.x + el.width : el.x, y };
  };
  const [step, ...rest] = FINISH_PREVIEW_ELEMENTS.map((el) =>
    el.type === 'arrow' ? { ...el, from: edge(el.from), to: edge(el.to) } : el,
  );
  const spacers = Array.from({ length: PALETTE_SKIP }, (_, i) => ({
    ...step!,
    id: `${SPACER_ID}${i}`,
  }));
  return [step!, ...spacers, ...rest];
}

/** The sample tab with the look applied, as a tab of its own. */
export function lookPreviewTab(look: TabLook): Tab {
  const blank = { id: `look-${look.id}`, name: look.label, elements: colouringSample() } as Tab;
  const styled = withLookApplied(blank, look);
  // The spacers go, and the arrow goes back on its pins, keeping the colour the pass gave it.
  const pinned = new Map(FINISH_PREVIEW_ELEMENTS.map((el) => [el.id, el]));
  return {
    ...styled,
    elements: styled.elements
      .filter((el) => !el.id.startsWith(SPACER_ID))
      .map((el) => {
        const original = pinned.get(el.id);
        return el.type === 'arrow' && original?.type === 'arrow'
          ? { ...el, from: original.from, to: original.to }
          : el;
      }),
  };
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
