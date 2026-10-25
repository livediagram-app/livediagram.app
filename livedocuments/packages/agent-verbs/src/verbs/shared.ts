// What the read verbs share: the list limits, dates, and reading a document's tabs.

import type { ApiClient } from '@liveworkspace/api-client';
import { resolveDocument, resolveTab, type ResolvedDocument, type TabSummary } from '../addressing';
import type { VerbContext } from '../define';

export {
  columns,
  day,
  LIST_DEFAULT_LIMIT,
  LIST_MAX_LIMIT,
  minute,
} from '@liveworkspace/agent-verbs/listing';

type DocumentWithTabs = ResolvedDocument & {
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

export type { ApiClient };
