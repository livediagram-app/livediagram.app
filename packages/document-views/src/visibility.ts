// Which elements a view prints (docs/specs/024-agents/blueprints/document-views.md "The view model"): an
// element is hidden when its layer is hidden, and so is an arrow pinned to a hidden element or riding on a
// hidden arrow, however long the chain (VW10): a printed end never names a hidden element's ref.
import { visibleLayerElements, type Element, type Layer } from '@livediagram/document';

export type Partition = { printed: Element[]; hidden: Element[] };

// The ids an arrow's pinned ends name; none for anything else.
export function pinnedIds(el: Element): string[] {
  if (el.type !== 'arrow') return [];
  return [el.from, el.to].flatMap((end) => (end.kind === 'pinned' ? [end.elementId] : []));
}

// The ids an arrow's ends hang on: pinned elements and the arrows it rides on.
function heldBy(el: Element): string[] {
  if (el.type !== 'arrow') return [];
  return [el.from, el.to].flatMap((end) =>
    end.kind === 'pinned' ? [end.elementId] : end.kind === 'on-arrow' ? [end.arrowId] : [],
  );
}

export function partitionVisible(tab: { elements: Element[]; layers?: Layer[] }): Partition {
  const visible = new Set(visibleLayerElements(tab.elements, tab.layers));
  const hiddenIds = new Set(tab.elements.filter((el) => !visible.has(el)).map((el) => el.id));
  // The arrows hanging on each id; hiding spreads from the hidden layers along them, each arrow once.
  const dependents = new Map<string, string[]>();
  for (const el of tab.elements)
    for (const id of heldBy(el)) {
      const list = dependents.get(id);
      if (list) list.push(el.id);
      else dependents.set(id, [el.id]);
    }
  const queue = [...hiddenIds];
  for (let at = queue.pop(); at !== undefined; at = queue.pop())
    for (const id of dependents.get(at) ?? []) {
      if (hiddenIds.has(id)) continue;
      hiddenIds.add(id);
      queue.push(id);
    }
  const printed: Element[] = [];
  const hidden: Element[] = [];
  for (const el of tab.elements) (hiddenIds.has(el.id) ? hidden : printed).push(el);
  return { printed, hidden };
}
