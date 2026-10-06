// read_document (docs/specs/015-api/mcp-server.md §4.2; docs/specs/024-agents/document-views.md "Where
// views are made"): a tab read as a view, the outline by default and fitted to a token budget, instead
// of its element JSON. The elements on request (`format: "json"`), a PNG only with `image: true`.
import {
  isRefErrorBody,
  type DocumentResponse,
  type TabResponse,
  type TabViewName,
} from '@livediagram/api-schema';
import { ApiError, apiJson, apiText } from './api';
import type { Env } from './env';
import { tabPreview } from './image-result';
import { READ_DOCUMENT_DEFAULT_BUDGET } from './schema';
import { deepLink, errorResult, textResult, viewResult, type ToolResult } from './tool-helpers';

export type ReadDocumentArgs = {
  documentId: string;
  tabId?: string;
  view?: TabViewName;
  budget?: number;
  only?: string;
  ref?: string;
  q?: string;
  coarse?: boolean;
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

function viewQuery(args: ReadDocumentArgs, view: TabViewName, budget: number): string {
  const query = new URLSearchParams({ view, door: 'mcp', budget: String(budget) });
  for (const key of ['only', 'ref', 'q'] as const) {
    const value = args[key];
    if (value !== undefined) query.set(key, value);
  }
  for (const key of ['coarse', 'all', 'style'] as const) if (args[key]) query.set(key, '1');
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
  const message = typeof body === 'object' && body !== null ? Reflect.get(body, 'message') : null;
  return typeof message === 'string' ? errorResult(message) : null;
}

export async function readDocument(
  env: Env,
  token: string,
  args: ReadDocumentArgs,
): Promise<ToolResult> {
  const view = args.view ?? 'outline';
  const budget = args.budget ?? READ_DOCUMENT_DEFAULT_BUDGET;
  const asJson = args.format === 'json';
  console.info('[mcp] read_document', {
    view: asJson ? 'json' : view,
    image: args.image === true,
    budget,
  });

  const { document } = await apiJson<DocumentResponse>(
    env,
    token,
    `/documents/${encodeURIComponent(args.documentId)}`,
  );
  const summary =
    args.tabId === undefined ? document.tabs[0] : document.tabs.find((t) => t.id === args.tabId);
  const tabId = args.tabId ?? summary?.id;
  if (tabId === undefined) return errorResult('That document has no tabs.');
  const tabPath = `/documents/${encodeURIComponent(document.id)}/tabs/${encodeURIComponent(tabId)}`;
  const auth = { env, token, documentId: document.id };

  if (asJson) {
    const { tab } = await apiJson<TabResponse>(env, token, tabPath);
    const result = textResult({
      id: document.id,
      name: document.name,
      tab: { id: tab.id, name: tab.name, rev: tab.rev, elements: tab.elements },
      url: deepLink(document.id),
    });
    if (!args.image) return result;
    return { ...result, content: [...result.content, await tabPreview(tab, auth)] };
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
  if (rev === null) throw new Error('read_document: the view came back without its tab revision');
  const result = viewResult(read.text, {
    id: document.id,
    name: document.name,
    tab: { id: tabId, name: summary?.name ?? '', rev, view },
    url: deepLink(document.id),
  });
  if (plain === null) return result;
  return { ...result, content: [...result.content, await tabPreview(plain.tab, auth)] };
}
