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
