// The one model every tab view reads (docs/specs/024-agents/blueprints/design-views.md "The view
// model"), built once per render.
import {
  computeRefs,
  pagesOf,
  pageKindOf,
  isKnownElement,
  kindWordOf,
  tabKindOf,
  type ComponentLookup,
  type DesignComponent,
  type Element,
  type RefTable,
  type Tab,
} from '@livedesign/design';
import { edgesOf, type Edges } from './edges';
import { countElements, threadCounts, type HeaderFacts } from './header';
import { buildViewTree, type ViewTree } from './tree';
import { partitionVisible, pinnedIds } from './visibility';

// What the caller knows beyond the tab: its revision, and the design's tab ids in order (VW4).
// `selected`: the owner's live selection for `show selected`; null or absent when it was not read (VW68).
// `components`: the design's mains (or those the tab's instances use), which name each instance's main (VW70); absent
// when the caller did not read the library.
export type ViewContext = {
  rev?: number;
  tabIds?: readonly string[];
  selected?: readonly string[] | null;
  components?: readonly DesignComponent[];
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
  // The main an instance draws, by id; null when the caller gave no library (`(main not loaded)`).
  componentOf: ComponentLookup | null;
};

// Tab refs unique among the design's tabs; a tab outside them (no design context) takes the
// ref it would have alone (VW4).
function tabRefsFor(tabId: string, tabIds: readonly string[] | undefined): (id: string) => string {
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
    ...(tab.finish ? { finish: tab.finish } : {}),
    ...pagesFacts(tab),
  };
}

// The tab's pages by kind, for the header (docs/specs/024-agents/pages-for-agents.md "Reading").
function pagesFacts(tab: Tab): Pick<HeaderFacts, 'pages'> {
  const pages = pagesOf(tab);
  const kinds: NonNullable<HeaderFacts['pages']>['kinds'] = {};
  // A blank page (its kind not chosen yet) counts among the pages alone.
  for (const p of pages) {
    const kind = pageKindOf(p);
    if (kind) kinds[kind] = (kinds[kind] ?? 0) + 1;
  }
  return { pages: { pages: pages.length, kinds } };
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
  return {
    tab,
    printed,
    hidden,
    refs,
    tabRefOf,
    kindOf,
    tree,
    edges,
    facts,
    componentOf: lookupOf(context),
  };
}

function lookupOf({ components }: ViewContext): ComponentLookup | null {
  if (components === undefined) return null;
  const byId = new Map(components.map((c) => [c.id, c] as const));
  return (id) => byId.get(id);
}
