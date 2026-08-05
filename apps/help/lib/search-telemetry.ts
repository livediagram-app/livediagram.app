// Help-centre search telemetry (spec/22).
//
// The help centre reported article VIEWS and the helpful / not-really vote,
// but nothing about the search that leads to them — so the most actionable
// number the help app can produce was missing: a query that found NOTHING.
// A view tells you an article exists; a zero-result search tells you which
// article to write next.
//
// What goes on the wire is the OUTCOME only — 'Results' or 'NoResults' —
// never the query. The query is user-generated content and the one thing
// spec/22 forbids; the outcome is a two-value preset. Which words came up
// dry is deliberately not recoverable from this, and that is the trade: the
// volume of dry searches is the signal we act on.

import { track } from './telemetry';

// Settle time after the last keystroke. Long enough that "flowc" on the way
// to "flowchart" doesn't report its own dry search, short enough that a
// reader who gives up and closes the tab has already been counted.
export const SEARCH_SETTLE_MS = 900;

// Queries already reported on this page. Dedupes the back-and-forth of
// editing one query (delete a character, retype it) into a single event.
// Lower-cased locally and never sent — see the header.
const seen = new Set<string>();

export function reportHelpSearch(query: string, resultCount: number): void {
  const key = query.trim().toLowerCase();
  if (!key || seen.has(key)) return;
  seen.add(key);
  track('Help', 'Searched', resultCount > 0 ? 'Results' : 'NoResults');
}

// Test seam: the module-level dedupe would otherwise leak between cases.
export function resetHelpSearchReports(): void {
  seen.clear();
}
