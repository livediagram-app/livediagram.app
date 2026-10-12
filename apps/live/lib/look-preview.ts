// A look's card preview (docs/specs/011-theme/canvas-and-theme-dialog.md "Looks"): the Finish preview's sample
// diagram with the look applied (theme colours, finish, font, canvas colour and pattern), drawn by the tab exporter so
// the card shows exactly what the tab will. Several cards share one page, so the exporter's fixed pattern id is made
// unique per look.
import type { ArrowElement, Element, Tab } from '@livediagram/document';
import { renderTabToSvg } from '@/lib/export-tab';
import { FINISH_PREVIEW_ELEMENTS } from '@/lib/finish-preview';
import { withLookApplied, type TabLook } from '@/lib/tab-looks';

const EXPORT_PATTERN_ID = 'lvd-export-bg';

// The sample's arrow, unpinned at the points its pins draw (the step's east edge, the decision's west tip), for the
// colouring pass only. A multi-colour theme colours by branch: pinned, the step is the root (the theme's neutral) and
// only the decision takes a palette colour; unpinned, each box is its own branch and the card shows two of the
// palette's colours. A single-colour theme paints the arrow the same either way.
function colouringSample(): Element[] {
  const byId = new Map(FINISH_PREVIEW_ELEMENTS.map((el) => [el.id, el]));
  const edge = (end: ArrowElement['from']) => {
    if (end.kind !== 'pinned') return end;
    const el = byId.get(end.elementId) as { x: number; y: number; width: number; height: number };
    const y = el.y + el.height / 2;
    return { kind: 'free' as const, x: end.anchor === 'e' ? el.x + el.width : el.x, y };
  };
  return FINISH_PREVIEW_ELEMENTS.map((el) =>
    el.type === 'arrow' ? ({ ...el, from: edge(el.from), to: edge(el.to) } as Element) : el,
  );
}

/** The sample tab with the look applied, as a tab of its own. */
export function lookPreviewTab(look: TabLook): Tab {
  const blank = { id: `look-${look.id}`, name: look.label, elements: colouringSample() } as Tab;
  const styled = withLookApplied(blank, look);
  // The arrow goes back on its pins, keeping the colour the pass gave it.
  const pinned = new Map(FINISH_PREVIEW_ELEMENTS.map((el) => [el.id, el]));
  return {
    ...styled,
    elements: styled.elements.map((el) => {
      const original = pinned.get(el.id);
      return el.type === 'arrow' && original?.type === 'arrow'
        ? { ...el, from: original.from, to: original.to }
        : el;
    }),
  };
}

/** The look's card preview as SVG markup, its ids scoped to the look. */
export function lookPreviewSvg(look: TabLook): string {
  const svg = renderTabToSvg(lookPreviewTab(look));
  return svg.split(EXPORT_PATTERN_ID).join(`lvd-look-${look.id}-bg`);
}
