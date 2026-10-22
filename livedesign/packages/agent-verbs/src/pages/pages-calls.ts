// An agent's Pages calls (docs/specs/024-agents/pages-for-agents.md): change_pages on the MCP and
// `page set` on the CLI. Each finds the
// tab ("Which tab"), sends one request to the pages route, and answers what it did or why not,
// in the same words on both doors.
import { ApiError, type ApiClient } from '@livedesign/api-client';
import {
  CLIENT_HEADER,
  type DocumentResponse,
  type PagesAnswer,
  type PageChange,
  type TabResponse,
} from '@livedesign/api-schema';
import type { Tab } from '@livedesign/document';
import { apiRefusalOf } from '../api-refusal';
import { tabPath } from '../verbs/shared';

export type PagesRefused = { ok: false; code: string; message: string; change?: number };
export type PagesDone = { ok: true; documentId: string; tabId: string } & PagesAnswer;
type PagesDoor = 'mcp' | 'cli';

const documentPath = (id: string) => `/documents/${encodeURIComponent(id)}`;

const refusedBy = (err: unknown): PagesRefused => {
  if (err instanceof ApiError && err.status < 500) {
    let body: { message?: unknown; change?: unknown } = {};
    try {
      body = JSON.parse(err.body) as typeof body;
    } catch {
      /* not JSON: the generic words */
    }
    if (err.code && typeof body.message === 'string')
      return {
        ok: false,
        code: err.code,
        message: body.message,
        ...(typeof body.change === 'number' ? { change: body.change } : {}),
      };
  }
  const known = apiRefusalOf(err);
  if (!known) throw err;
  return { ok: false, ...known };
};

/** The tab a Pages call acts on: the one named, else the document's first tab. Every tab holds pages. */
export async function pagesTabOf(
  api: ApiClient,
  documentId: string,
  tabId: string | undefined,
): Promise<{ tabId: string; tab: Tab } | PagesRefused> {
  try {
    const id = tabId ?? (await firstTabId(api, documentId));
    if (id === null)
      return { ok: false, code: 'tab_needed', message: 'This document has no tab you can reach.' };
    const { tab } = await api.json<TabResponse>(tabPath(documentId, id));
    return { tabId: id, tab };
  } catch (err) {
    return refusedBy(err);
  }
}

async function firstTabId(api: ApiClient, documentId: string): Promise<string | null> {
  const { document } = await api.json<DocumentResponse>(documentPath(documentId));
  const [first] = document.tabs
    .filter((t) => !t.outOfScope)
    .sort((a, b) => a.orderIndex - b.orderIndex);
  return first?.id ?? null;
}

async function send(
  api: ApiClient,
  documentId: string,
  tabId: string,
  body: { pages: PageChange[] },
  door: PagesDoor,
): Promise<PagesDone | PagesRefused> {
  try {
    const answer = await api.json<PagesAnswer>(`${tabPath(documentId, tabId)}/pages`, {
      method: 'POST',
      headers: { [CLIENT_HEADER]: door },
      body: JSON.stringify(body),
    });
    return { ok: true, documentId, tabId, ...answer };
  } catch (err) {
    return refusedBy(err);
  }
}

/** change_pages / `page set`: up to 50 page changes as one edit. */
export async function changePages(
  api: ApiClient,
  documentId: string,
  input: { tabId?: string; changes: PageChange[] },
  door: PagesDoor,
): Promise<PagesDone | PagesRefused> {
  const found = await pagesTabOf(api, documentId, input.tabId);
  if ('ok' in found) return found;
  return send(api, documentId, found.tabId, { pages: input.changes }, door);
}
