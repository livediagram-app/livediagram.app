// read_project (docs/specs/015-api/mcp-server.md §4.2; docs/specs/024-agents/project-views.md "Where
// views are made"): a tab read as a view, the outline by default and fitted to a token budget, instead
// of its element JSON. The elements on request (`format: "json"`), a PNG only with `image: true`.
import {
  isRefErrorBody,
  type ProjectResponse,
  type TabResponse,
  type TabViewName,
} from '@liveplanner/api-schema';
import { ApiError, apiJson, apiText } from './api';
import type { Env } from './env';
import { tabPreview } from './image-result';
import { READ_PROJECT_DEFAULT_BUDGET } from '@liveplanner/agent-verbs/mcp';
import { deepLink, errorResult, textResult, viewResult, type ToolResult } from './tool-helpers';

type ReadProjectArgs = {
  projectId: string;
  tabId?: string;
  view?: TabViewName;
  budget?: number;
  only?: string;
  ref?: string;
  q?: string;
  all?: boolean;
  style?: boolean;
  format?: 'view' | 'json';
  image?: boolean;
};

// `W/"41"` → 41.
export function revFromEtag(etag: string | null): number | null {
  const match = etag === null ? null : /^W\/"(\d+)"$/.exec(etag);
  return match ? Number(match[1]) : null;
}

function viewQuery(args: ReadProjectArgs, view: TabViewName, budget: number): string {
  const query = new URLSearchParams({ view, door: 'mcp', budget: String(budget) });
  for (const key of ['only', 'ref', 'q'] as const) {
    const value = args[key];
    if (value !== undefined) query.set(key, value);
  }
  for (const key of ['all', 'style'] as const) if (args[key]) query.set(key, '1');
  return query.toString();
}

// A view the api refused (a ref that names nothing or several, a parameter its view does not take):
// model-correctable, so a result naming the candidates rather than a thrown error.
function refusedView(err: unknown): ToolResult | null {
  if (!(err instanceof ApiError) || (err.status !== 400 && err.status !== 404)) return null;
  let body: unknown;
  try {
    body = JSON.parse(err.body);
  } catch {
    return null;
  }
  if (isRefErrorBody(body)) {
    const candidates = body.candidates.map(
      (c) => `${c.kind} ${c.ref}${c.label === null ? '' : ` ${JSON.stringify(c.label)}`}`,
    );
    return errorResult(
      candidates.length === 0
        ? body.message
        : `${body.message}. Candidates: ${candidates.join('; ')}`,
    );
  }
  const message: unknown =
    typeof body === 'object' && body !== null ? Reflect.get(body, 'message') : null;
  return typeof message === 'string' ? errorResult(message) : null;
}

export async function readProject(
  env: Env,
  token: string,
  args: ReadProjectArgs,
): Promise<ToolResult> {
  const view = args.view ?? 'outline';
  const budget = args.budget ?? READ_PROJECT_DEFAULT_BUDGET;
  const asJson = args.format === 'json';
  console.info('[mcp] read_project', {
    view: asJson ? 'json' : view,
    image: args.image === true,
    budget,
  });

  const { project } = await apiJson<ProjectResponse>(
    env,
    token,
    `/projects/${encodeURIComponent(args.projectId)}`,
  );
  const summary =
    args.tabId === undefined ? project.tabs[0] : project.tabs.find((t) => t.id === args.tabId);
  const tabId = args.tabId ?? summary?.id;
  if (tabId === undefined) return errorResult('That plan has no tabs.');
  // Every tab, in order, so a caller can read the others (a Plan template's Board, Requests and Flow).
  const tabs = [...project.tabs]
    .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))
    .map((t) => ({ id: t.id, name: t.name }));
  if (!summary)
    return errorResult(
      `No tab "${tabId}" in this plan. Tabs: ${tabs.map((t) => `${t.name} (${t.id})`).join(', ')}.`,
    );
  const tabPath = `/projects/${encodeURIComponent(project.id)}/tabs/${encodeURIComponent(tabId)}`;
  const auth = { env, token, projectId: project.id };

  if (asJson) {
    const { tab } = await apiJson<TabResponse>(env, token, tabPath);
    const result = textResult({
      id: project.id,
      name: project.name,
      tab: { id: tab.id, name: tab.name, rev: tab.rev, elements: tab.elements },
      tabs,
      url: deepLink(env, project.id),
    });
    if (!args.image) return result;
    return { ...result, content: [...result.content, ...(await tabPreview(tab, auth))] };
  }

  let read: { text: string; etag: string | null };
  let plain: TabResponse | null;
  try {
    // The view and, for the preview, the plain tab, in parallel (VW48).
    [read, plain] = await Promise.all([
      apiText(env, token, `${tabPath}?${viewQuery(args, view, budget)}`),
      args.image ? apiJson<TabResponse>(env, token, tabPath) : null,
    ]);
  } catch (err) {
    const refused = refusedView(err);
    if (refused) return refused;
    throw err;
  }
  const rev = revFromEtag(read.etag);
  if (rev === null) throw new Error('read_project: the view came back without its tab revision');
  const result = viewResult(read.text, {
    id: project.id,
    name: project.name,
    tab: { id: tabId, name: summary.name, rev, view },
    tabs,
    url: deepLink(env, project.id),
  });
  if (plain === null) return result;
  return { ...result, content: [...result.content, ...(await tabPreview(plain.tab, auth))] };
}
