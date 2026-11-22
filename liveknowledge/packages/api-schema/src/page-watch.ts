// Watching a page (docs/specs/030-knowledgebase/watching.md) on the wire: the caller's own watch of a page and how many
// watch it. The api stores watches (apps/api/src/knowledge/page-watch.ts) and tells watchers through the Inbox and a
// daily digest; the editor draws the page menu's rows and the Page Info rail's Watch row.

/** A page alone, or the page and every page under it. */
export type PageWatchScope = 'page' | 'section';

export type PageWatchResponse = {
  /** The caller's own watch of this page; null when they have none here (or are a guest, or an agent). */
  watching: PageWatchScope | null;
  /** The nearest section above the page the caller watches, when that is what covers it and the page has no watch
   *  of its own. */
  through: { tab: string; name: string } | null;
  /** How many people's watches cover the page, once each. */
  watchers: number;
  /** Whether the page has subpages, so Watch This Section is offered. */
  section: boolean;
};

/** `PUT .../pages/<tab>/watch`: the caller's watch of this page; null removes it. */
export type PageWatchChange = { scope: PageWatchScope | null };

/** At most this many watches a knowledgebase (`watchers_full`). */
export const WATCHES_PER_KNOWLEDGEBASE_MAX = 2000;
/** At most this many watch changes a minute a person a knowledgebase (`watching_too_fast`). */
export const WATCH_CHANGES_PER_MINUTE = 30;

export const isPageWatchScope = (value: unknown): value is PageWatchScope =>
  value === 'page' || value === 'section';
