// What the read verbs share: the list limits, dates, and reading a document's tabs.

import type { ApiClient } from '@livediagram/api-client';
import { resolveDocument, resolveTab, type ResolvedDocument, type TabSummary } from '../addressing';
import type { VerbContext } from '../define';

export const LIST_DEFAULT_LIMIT = 20;
export const LIST_MAX_LIMIT = 200;

// `YYYY-MM-DD`, and `YYYY-MM-DD HH:MM`, in UTC so output does not depend on the machine.
export const day = (ms: number) => new Date(ms).toISOString().slice(0, 10);
export const minute = (ms: number) => new Date(ms).toISOString().slice(0, 16).replace('T', ' ');

// Rows as aligned columns, two spaces apart; the last column is not padded.
export function columns(rows: readonly (readonly string[])[]): string[] {
  const widths: number[] = [];
  for (const row of rows)
    row.forEach((cell, i) => (widths[i] = Math.max(widths[i] ?? 0, cell.length)));
  return rows.map((row) =>
    row.map((cell, i) => (i === row.length - 1 ? cell : cell.padEnd(widths[i]!))).join('  '),
  );
}

export type DocumentWithTabs = ResolvedDocument & {
  tabs: TabSummary[];
  presentation: string | null;
};

// The document a command names, its share code applied, with its tabs.
export async function documentOf(ctx: VerbContext, doc: string): Promise<DocumentWithTabs> {
  const resolved = await resolveDocument(ctx.api, doc, ctx.host, ctx.log);
  if (resolved.shareCode) ctx.useShareCode(resolved.shareCode);
  const { document } = await ctx.api.json<{
    document: { tabs: TabSummary[]; presentation?: string | null };
  }>(`/documents/${encodeURIComponent(resolved.id)}`);
  return { ...resolved, tabs: document.tabs, presentation: document.presentation ?? null };
}

export async function tabOf(ctx: VerbContext, doc: string, tab: string | undefined) {
  const document = await documentOf(ctx, doc);
  return { document, tab: resolveTab(document.tabs, tab, doc, ctx.log) };
}

export const tabPath = (documentId: string, tabId: string) =>
  `/documents/${encodeURIComponent(documentId)}/tabs/${encodeURIComponent(tabId)}`;

// A document's item store (docs/specs/026-plan/items.md), for the CLI's item verbs and the MCP item tools.
export const itemsPath = (documentId: string) =>
  `/documents/${encodeURIComponent(documentId)}/items`;

export type { ApiClient };
