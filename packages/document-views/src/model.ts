// The one model every tab view reads (docs/specs/024-agents/blueprints/document-views.md "The view
// model"), built once per render.
import {
  computeRefs,
  isKnownElement,
  kindWordOf,
  tabKindOf,
  type Element,
  type RefTable,
  type Tab,
} from '@livediagram/document';
import { edgesOf, type Edges } from './edges';
import { countElements, threadCounts, type HeaderFacts } from './header';
import { buildViewTree, type ViewTree } from './tree';
import { partitionVisible, pinnedIds } from './visibility';

// What the caller knows beyond the tab: its revision, and the document's tab ids in order (VW4).
export type ViewContext = { rev?: number; tabIds?: readonly string[] };

export type ViewModel = {
  tab: Tab;
  printed: Element[];
  hidden: Element[];
  refs: RefTable;
  tabRefOf: (tabId: string) => string;
  kindOf: (el: Element) => string;
  tree: ViewTree;
  edges: Edges;
  facts: HeaderFacts;
};

export function buildViewModel(tab: Tab, context: ViewContext = {}): ViewModel {
  const { printed, hidden } = partitionVisible(tab);
  const refs = computeRefs(tab.elements.map((el) => el.id));
  const tabRefs = computeRefs(context.tabIds?.includes(tab.id) ? context.tabIds : [tab.id]);
  // A tab outside the known ids (no document context) takes the ref it would have alone (VW4).
  const tabRefOf = (tabId: string) =>
    tabRefs.ids.includes(tabId) ? tabRefs.refOf(tabId) : computeRefs([tabId]).refOf(tabId);
  const kinds = new Map<Element, string>();
  const kindOf = (el: Element) => {
    const known = kinds.get(el);
    if (known !== undefined) return known;
    const kind = kindWordOf(el);
    kinds.set(el, kind);
    return kind;
  };
  const tree = buildViewTree(printed, new Set(printed.flatMap(pinnedIds)));
  const edges = edgesOf(printed, refs, new Set(tree.nodes.keys()));
  const facts: HeaderFacts = {
    tab: { id: tab.id, ref: tabRefOf(tab.id), name: tab.name, kind: tabKindOf(tab) },
    elements: printed.length,
    counts: countElements(printed),
    hidden: hidden.length,
    unknown: printed.filter((el) => !isKnownElement(el)).length,
    threads: threadCounts(printed),
    rev: context.rev ?? null,
  };
  return { tab, printed, hidden, refs, tabRefOf, kindOf, tree, edges, facts };
}
