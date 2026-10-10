// The one model every tab view reads (docs/specs/024-agents/blueprints/document-views.md "The view
// model"), built once per render.
import {
  computeRefs,
  illustratePagesOf,
  opensInOf,
  pageKindOf,
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
// `selected`: the owner's live selection for `show selected`; null or absent when it was not read (VW68).
export type ViewContext = {
  rev?: number;
  tabIds?: readonly string[];
  selected?: readonly string[] | null;
};

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

// Tab refs unique among the document's tabs; a tab outside them (no document context) takes the
// ref it would have alone (VW4).
export function tabRefsFor(
  tabId: string,
  tabIds: readonly string[] | undefined,
): (id: string) => string {
  const tabRefs = computeRefs(tabIds?.includes(tabId) ? tabIds : [tabId]);
  const known = new Set(tabRefs.ids);
  return (id) => (known.has(id) ? tabRefs.refOf(id) : computeRefs([id]).refOf(id));
}

function headerFacts(
  tab: Tab,
  printed: readonly Element[],
  hidden: number,
  tabRefOf: (id: string) => string,
  rev: number | undefined,
): HeaderFacts {
  return {
    tab: { id: tab.id, ref: tabRefOf(tab.id), name: tab.name, kind: tabKindOf(tab) },
    elements: printed.length,
    counts: countElements(printed),
    hidden,
    unknown: printed.filter((el) => !isKnownElement(el)).length,
    threads: threadCounts(printed),
    rev: rev ?? null,
    ...illustrateFacts(tab),
  };
}

// An Illustrate tab's pages by kind, for the header (docs/specs/024-agents/illustrate-for-agents.md
// "Reading"); nothing for a tab in another mode.
function illustrateFacts(tab: Tab): Pick<HeaderFacts, 'illustrate'> {
  if (opensInOf(tab) !== 'illustrate') return {};
  const pages = illustratePagesOf(tab);
  const kinds: NonNullable<HeaderFacts['illustrate']>['kinds'] = {};
  for (const p of pages) kinds[pageKindOf(p)] = (kinds[pageKindOf(p)] ?? 0) + 1;
  return { illustrate: { pages: pages.length, kinds } };
}

// A tab's header facts alone, without its tree: what `overview` keeps of each tab body it reads.
export function headerFactsOf(tab: Tab, context: ViewContext = {}): HeaderFacts {
  const { printed, hidden } = partitionVisible(tab);
  return headerFacts(tab, printed, hidden.length, tabRefsFor(tab.id, context.tabIds), context.rev);
}

export function buildViewModel(tab: Tab, context: ViewContext = {}): ViewModel {
  const { printed, hidden } = partitionVisible(tab);
  const refs = computeRefs(tab.elements.map((el) => el.id));
  const tabRefOf = tabRefsFor(tab.id, context.tabIds);
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
  const facts = headerFacts(tab, printed, hidden.length, tabRefOf, context.rev);
  return { tab, printed, hidden, refs, tabRefOf, kindOf, tree, edges, facts };
}
