// What the read verbs share: the list limits, dates, and reading a project's tabs.

import type { ApiClient } from '@liveworkspace/api-client';
import { resolveProject, resolveTab, type ResolvedProject, type TabSummary } from '../addressing';
import type { VerbContext } from '../define';

export {
  columns,
  day,
  LIST_DEFAULT_LIMIT,
  LIST_MAX_LIMIT,
  minute,
  moreLine,
} from '@liveworkspace/agent-verbs/listing';

type ProjectWithTabs = ResolvedProject & { tabs: TabSummary[] };

// The project a command names, its share code applied, with its tabs.
export async function projectOf(ctx: VerbContext, projectRef: string): Promise<ProjectWithTabs> {
  const resolved = await resolveProject(ctx.api, projectRef, ctx.host, ctx.log);
  if (resolved.shareCode) ctx.useShareCode(resolved.shareCode);
  const { project } = await ctx.api.json<{
    project: { tabs: TabSummary[] };
  }>(`/projects/${encodeURIComponent(resolved.id)}`);
  return { ...resolved, tabs: project.tabs };
}

export async function tabOf(ctx: VerbContext, projectRef: string, tab: string | undefined) {
  const project = await projectOf(ctx, projectRef);
  return { project, tab: resolveTab(project.tabs, tab, projectRef, ctx.log) };
}

export const tabPath = (projectId: string, tabId: string) =>
  `/projects/${encodeURIComponent(projectId)}/tabs/${encodeURIComponent(tabId)}`;

// A project's item store (docs/specs/026-plan/items.md), for the CLI's item verbs and the MCP item tools.
export const itemsPath = (projectId: string) => `/projects/${encodeURIComponent(projectId)}/items`;

export type { ApiClient };
