// What D1's listings know of a plan's content (docs/specs/015-api/api.md "Storage"): the `content_summary`
// column, pushed by the plan's Durable Object (plan-room/plan-outbox.ts), never a tab body. The Explorer, Home,
// Shared with me and the empty-project sweep read it here; the content itself is the Durable Object's.

// The column's JSON. `firstTabCount` is the first tab's element count (-1 while unknown, null with no tab);
// `tabCounts` each tab's, for a tab-scoped reader; `stats` the Details view's numbers (tab-stats.ts); and
// `hasContent` whether any tab holds an element, a form or a body that is not JSON (the sweep's test).
export type ContentSummary = {
  firstTabCount: number | null;
  tabCounts: Record<string, number>;
  stats: { mode: string; elements: number; comments: number; bytes: number } | null;
  hasContent: boolean;
};

// The `empty` column of a project list (docs/specs/006-project/project-snapshots.md): the element count of the
// project's first tab, or of `scopeTabSql`'s tab when that is not null. NULL = no tab (or a scope tab the project
// does not hold), -1 = not yet known, which is also what a project whose summary has not landed yet reads as.
export function firstTabCountSql(projectIdSql: string, scopeTabSql: string | null = null): string {
  const counted = scopeTabSql
    ? `CASE WHEN ${scopeTabSql} IS NULL THEN json_extract(cs.content_summary, '$.firstTabCount')
            ELSE json_extract(cs.content_summary, '$.tabCounts.' || json_quote(${scopeTabSql})) END`
    : `json_extract(cs.content_summary, '$.firstTabCount')`;
  return `(SELECT CASE WHEN cs.content_summary IS NULL THEN -1 ELSE ${counted} END
             FROM projects cs WHERE cs.id = ${projectIdSql}) AS first_tab_count`;
}

// A project's Details-view stats as the `doc_stats` column readProjectStats reads: JSON text, or NULL.
export function docStatsSql(projectIdSql: string): string {
  return `(SELECT json_extract(cs.content_summary, '$.stats')
             FROM projects cs WHERE cs.id = ${projectIdSql}) AS doc_stats`;
}

// No tab, or a counted tab with no elements. A count not yet known is not empty: its thumbnail is asked for.
export function isEmptyCount(firstTabCount: number | null | undefined): boolean {
  return firstTabCount == null || firstTabCount === 0;
}
