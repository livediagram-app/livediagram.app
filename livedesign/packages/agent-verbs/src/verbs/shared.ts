// What the read verbs share: the list limits, dates, and reading a design's tabs.

import type { ApiClient } from '@liveworkspace/api-client';
import { resolveDesign, resolveTab, type ResolvedDesign, type TabSummary } from '../addressing';
import type { VerbContext } from '../define';

export {
  columns,
  day,
  LIST_DEFAULT_LIMIT,
  LIST_MAX_LIMIT,
  minute,
} from '@liveworkspace/agent-verbs/listing';

type DesignWithTabs = ResolvedDesign & {
  tabs: TabSummary[];
};

// The design a command names, its share code applied, with its tabs.
export async function designOf(ctx: VerbContext, doc: string): Promise<DesignWithTabs> {
  const resolved = await resolveDesign(ctx.api, doc, ctx.host, ctx.log);
  if (resolved.shareCode) ctx.useShareCode(resolved.shareCode);
  const { design } = await ctx.api.json<{
    design: { tabs: TabSummary[] };
  }>(`/designs/${encodeURIComponent(resolved.id)}`);
  return { ...resolved, tabs: design.tabs };
}

export async function tabOf(ctx: VerbContext, doc: string, tab: string | undefined) {
  const design = await designOf(ctx, doc);
  return { design, tab: resolveTab(design.tabs, tab, doc, ctx.log) };
}

export const tabPath = (designId: string, tabId: string) =>
  `/designs/${encodeURIComponent(designId)}/tabs/${encodeURIComponent(tabId)}`;

export type { ApiClient };

// The line under a cut list: how many more, and the --limit that shows them all, never one past the flag's own
// maximum (which the flag would refuse); past it, only narrowing helps.
export function moreLine(shown: number, more: number, max: number, narrow: string): string {
  const all = shown + more;
  return all <= max
    ? `… ${more} more; --limit ${all}, or ${narrow}`
    : `… ${more} more; ${narrow} (--limit goes up to ${max})`;
}
