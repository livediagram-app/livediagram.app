// The knowledgebase's four views (docs/specs/030-knowledgebase/search-and-ask.md "The views"): Pages (the editor),
// Ask, Insights and Connect (mcp-connect.md). Which one shows lives in the address, as `?view=ask`, `?view=insights`
// or `?view=connect` (`?view=ai`, its name before, still opens Insights), so a reload
// keeps it and the browser's Back returns to the view before. Pages is the address with no `view`. Not in the hash:
// the hash is the open page's (`#t=<id>`), and the editor rewrites it whole on every page switch.

export type KnowledgeView = 'pages' | 'ask' | 'insights' | 'connect';

export const KNOWLEDGE_VIEW_PARAM = 'view';

export const KNOWLEDGE_VIEWS: readonly {
  view: KnowledgeView;
  label: string;
  // The name a phone's footer tab shows, where four full names do not fit.
  short: string;
  // The hover card's title, where it says more than the tab's name.
  hoverTitle?: string;
  about: string;
}[] = [
  {
    view: 'pages',
    label: 'Pages',
    short: 'Pages',
    about: 'Read and write the pages of this knowledgebase.',
  },
  {
    view: 'ask',
    label: 'Ask',
    short: 'Ask',
    about: 'Ask a question and get an answer from its pages.',
  },
  {
    view: 'insights',
    label: 'Insights',
    short: 'Insights',
    about: 'What agents know, read and could not find.',
  },
  {
    view: 'connect',
    // Owner 2026-11-22: the tab says what it connects.
    label: 'Connect MCP',
    short: 'Connect',
    hoverTitle: 'Connect an AI App',
    about:
      'Connect Claude, ChatGPT, Cursor or another AI app so it can read and write these pages.',
  },
];

/** The views the footer shows: all four, or without Connect when the person hid it (mcp-connect.md "Closing the
 *  tab"), unless Connect is the view open (a link or Connect an Agent opened it), which keeps its tab while it is. */
export function knowledgeViewsShown(
  showConnect: boolean,
  current: KnowledgeView,
): typeof KNOWLEDGE_VIEWS {
  return showConnect || current === 'connect' ? KNOWLEDGE_VIEWS : WITHOUT_CONNECT;
}

const WITHOUT_CONNECT = KNOWLEDGE_VIEWS.filter(({ view }) => view !== 'connect');

const NAMED: ReadonlySet<string> = new Set(['ask', 'insights', 'connect']);

/** Addresses from before a view was renamed: emails and bookmarks still say `?view=ai` for Insights. */
const FORMER: Readonly<Record<string, KnowledgeView>> = { ai: 'insights' };

/** The view an address names; anything it does not know is Pages. */
export function knowledgeViewOf(search: string): KnowledgeView {
  const named = new URLSearchParams(search).get(KNOWLEDGE_VIEW_PARAM);
  if (named === null) return 'pages';
  if (NAMED.has(named)) return named as KnowledgeView;
  return Object.hasOwn(FORMER, named) ? FORMER[named]! : 'pages';
}

/** The query a view keeps of its own (Insights' topic and Needs Attention's filter, insights.md "A topic's page"):
 *  dropped whenever an address is made for a view, so another view's address never carries them. */
const VIEW_QUERY_PARAMS = ['topic', 'show'] as const;

/** The address of a view: `href` with its `view` set, or taken out for Pages, and `query` (the view's own pairs)
 *  set after the view's old ones are dropped. The path, the rest of the query and the hash are kept. */
export function knowledgeViewHref(
  href: string,
  view: KnowledgeView,
  query: Readonly<Record<string, string>> = {},
): string {
  const url = new URL(href, 'https://liveknowledge.invalid');
  for (const name of VIEW_QUERY_PARAMS) url.searchParams.delete(name);
  if (view === 'pages') url.searchParams.delete(KNOWLEDGE_VIEW_PARAM);
  else url.searchParams.set(KNOWLEDGE_VIEW_PARAM, view);
  for (const [name, value] of Object.entries(query)) url.searchParams.set(name, value);
  return `${url.pathname}${url.search}${url.hash}`;
}

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

// The way back from a view's header (search-and-ask.md "The way back"): the views this tab stepped through by a history
// entry, newest last, each with the knowledgebase it was in. A press of a footer tab (or any `showKnowledgeView`) adds
// the view it left; Back and Forward walk it as the browser walks its entries. Replacing an entry adds nothing, and
// a page switch never touches the history (useTabEntryEffects replaces it), so the top is always the entry the
// browser's Back would land on.
type Step = { view: KnowledgeView; path: string };
const trail: Step[] = [];
// The view and knowledgebase last shown, to tell a Back (to the trail's top) from a Forward.
let seen: Step | null = null;
const here = (): Step => ({ view: currentKnowledgeView(), path: window.location.pathname });

function onHistoryMove(): void {
  const now = here();
  const top = trail.at(-1);
  if (top && top.view === now.view && top.path === now.path) trail.pop();
  else if (seen && (seen.view !== now.view || seen.path !== now.path)) trail.push(seen);
  seen = now;
  notify();
}

/** The view the header's chevron goes back to: the one before this, in this knowledgebase, else Pages. */
export function previousKnowledgeView(): KnowledgeView {
  if (typeof window === 'undefined') return 'pages';
  const top = trail.at(-1);
  return top && top.path === window.location.pathname ? top.view : 'pages';
}

/** Back from a view's header: the browser's Back when the entry before is a view of this knowledgebase (so the view is
 *  as it was left, the open page and the address with it), else Pages as a new entry (a view opened by its link).
 *  `extra` is how many of the view's own entries stand on top of its first (an Insights topic opened from its
 *  dashboard), stepped over too. */
export function backFromKnowledgeView(extra = 0): void {
  const top = trail.at(-1);
  if (top && top.path === window.location.pathname) {
    if (extra === 0) window.history.back();
    else window.history.go(-(1 + extra));
    return;
  }
  // Another knowledgebase's steps are no way back from this one.
  trail.length = 0;
  showKnowledgeView('pages');
}

/** Forgets the steps (a test's reset). */
export function resetKnowledgeViewTrail(): void {
  trail.length = 0;
  seen = null;
}

/** The view the address names now. */
export function currentKnowledgeView(): KnowledgeView {
  return typeof window === 'undefined' ? 'pages' : knowledgeViewOf(window.location.search);
}

const address = () => `${window.location.pathname}${window.location.search}${window.location.hash}`;

/** Show a view: a new history entry (so Back returns to the view before), or `replace` to stay on this one. `query`
 *  is the view's own place in it (an Insights topic); moving within a view adds no step to the way back. */
export function showKnowledgeView(
  view: KnowledgeView,
  opts: { replace?: boolean; query?: Readonly<Record<string, string>> } = {},
): void {
  if (typeof window === 'undefined') return;
  const href = knowledgeViewHref(window.location.href, view, opts.query);
  const within = view === currentKnowledgeView();
  // The same view: nothing to do unless its own place changes (a topic opened, or left for its dashboard).
  if (within && href === address()) return;
  if (
    within &&
    !opts.query &&
    !VIEW_QUERY_PARAMS.some((name) => new URLSearchParams(window.location.search).has(name))
  )
    return;
  if (!opts.replace && !within) trail.push(here());
  // Null, never history.state: Next skips its own state handed back (so useSearchParams keeps the old address),
  // and given null it copies that state across itself, so its Back and Forward still know the page
  // (packages/next-config history-state.test.js).
  if (opts.replace) window.history.replaceState(null, '', href);
  else window.history.pushState(null, '', href);
  seen = here();
  notify();
}

/** Tells `listener` when the view changes: a press here, or the browser's Back and Forward. */
export function subscribeKnowledgeView(listener: () => void): () => void {
  listeners.add(listener);
  if (listeners.size === 1) {
    seen ??= here();
    window.addEventListener('popstate', onHistoryMove);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener('popstate', onHistoryMove);
  };
}
