// What the read verbs share: the list limits, dates, and reading a design's tabs.

import type { ApiClient } from '@livedesign/api-client';
import { resolveDesign, resolveTab, type ResolvedDesign, type TabSummary } from '../addressing';
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

type DesignWithTabs = ResolvedDesign & {
  tabs: TabSummary[];
  presentation: string | null;
};

// The design a command names, its share code applied, with its tabs.
export async function designOf(ctx: VerbContext, doc: string): Promise<DesignWithTabs> {
  const resolved = await resolveDesign(ctx.api, doc, ctx.host, ctx.log);
  if (resolved.shareCode) ctx.useShareCode(resolved.shareCode);
  const { design } = await ctx.api.json<{
    design: { tabs: TabSummary[]; presentation?: string | null };
  }>(`/designs/${encodeURIComponent(resolved.id)}`);
  return { ...resolved, tabs: design.tabs, presentation: design.presentation ?? null };
}

export async function tabOf(ctx: VerbContext, doc: string, tab: string | undefined) {
  const design = await designOf(ctx, doc);
  return { design, tab: resolveTab(design.tabs, tab, doc, ctx.log) };
}

export const tabPath = (designId: string, tabId: string) =>
  `/designs/${encodeURIComponent(designId)}/tabs/${encodeURIComponent(tabId)}`;

export type { ApiClient };
