// The knowledgebase's three views (docs/specs/030-knowledgebase/search-and-ask.md "The three views"): Pages (the
// editor), Ask and AI Knowledge. Which one shows lives in the address, as `?view=ask` or `?view=ai`, so a reload
// keeps it and the browser's Back returns to the view before. Pages is the address with no `view`. Not in the hash:
// the hash is the open page's (`#t=<id>`), and the editor rewrites it whole on every page switch.

export type KnowledgeView = 'pages' | 'ask' | 'ai';

export const KNOWLEDGE_VIEW_PARAM = 'view';

export const KNOWLEDGE_VIEWS: readonly {
  view: KnowledgeView;
  label: string;
  // The name a phone's footer tab shows, where three full names do not fit.
  short: string;
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
    view: 'ai',
    label: 'AI Knowledge',
    short: 'AI',
    about: 'What agents know, read and could not find.',
  },
];

/** The view an address names; anything it does not know is Pages. */
export function knowledgeViewOf(search: string): KnowledgeView {
  const named = new URLSearchParams(search).get(KNOWLEDGE_VIEW_PARAM);
  return named === 'ask' || named === 'ai' ? named : 'pages';
}

/** The address of a view: `href` with its `view` set, or taken out for Pages. The path, the rest of the query and
 *  the hash are kept. */
export function knowledgeViewHref(href: string, view: KnowledgeView): string {
  const url = new URL(href, 'https://liveknowledge.invalid');
  if (view === 'pages') url.searchParams.delete(KNOWLEDGE_VIEW_PARAM);
  else url.searchParams.set(KNOWLEDGE_VIEW_PARAM, view);
  return `${url.pathname}${url.search}${url.hash}`;
}

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

/** The view the address names now. */
export function currentKnowledgeView(): KnowledgeView {
  return typeof window === 'undefined' ? 'pages' : knowledgeViewOf(window.location.search);
}

/** Show a view: a new history entry (so Back returns to the view before), or `replace` to stay on this one. */
export function showKnowledgeView(view: KnowledgeView, opts: { replace?: boolean } = {}): void {
  if (typeof window === 'undefined' || view === currentKnowledgeView()) return;
  const href = knowledgeViewHref(window.location.href, view);
  // Null, never history.state: Next skips its own state handed back (so useSearchParams keeps the old address),
  // and given null it copies that state across itself, so its Back and Forward still know the page
  // (packages/next-config history-state.test.js).
  if (opts.replace) window.history.replaceState(null, '', href);
  else window.history.pushState(null, '', href);
  notify();
}

/** Tells `listener` when the view changes: a press here, or the browser's Back and Forward. */
export function subscribeKnowledgeView(listener: () => void): () => void {
  listeners.add(listener);
  if (listeners.size === 1) window.addEventListener('popstate', notify);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener('popstate', notify);
  };
}
