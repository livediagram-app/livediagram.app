// Which elements a view prints (docs/specs/024-agents/blueprints/document-views.md "The view model"): an
// element is hidden when its layer is hidden, and so is an arrow pinned to a hidden element (VW10).
import { visibleLayerElements, type Element, type Layer } from '@livediagram/document';

export type Partition = { printed: Element[]; hidden: Element[] };

// The ids an arrow's pinned ends name; none for anything else.
export function pinnedIds(el: Element): string[] {
  if (el.type !== 'arrow') return [];
  return [el.from, el.to].flatMap((end) => (end.kind === 'pinned' ? [end.elementId] : []));
}

export function partitionVisible(tab: { elements: Element[]; layers?: Layer[] }): Partition {
  const visible = new Set(visibleLayerElements(tab.elements, tab.layers));
  const hiddenIds = new Set(tab.elements.filter((el) => !visible.has(el)).map((el) => el.id));
  const printed: Element[] = [];
  const hidden: Element[] = [];
  for (const el of tab.elements) {
    const shown = visible.has(el) && !pinnedIds(el).some((id) => hiddenIds.has(id));
    (shown ? printed : hidden).push(el);
  }
  return { printed, hidden };
}
