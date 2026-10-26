// An agent's Pages calls (docs/specs/024-agents/pages-for-agents.md): change_pages on the MCP and
// `page set` on the CLI. Each finds the
// tab ("Which tab"), sends one request to the pages route, and answers what it did or why not,
// in the same words on both doors.
import { ApiError, type ApiClient } from '@liveworkspace/api-client';
import {
  CLIENT_HEADER,
  type DesignResponse,
  type PagesAnswer,
  type PageChange,
  type TabResponse,
} from '@livedesign/api-schema';
import type { Tab } from '@livedesign/design';
import { apiRefusalOf } from '../api-refusal';
import { tabPath } from '../verbs/shared';

export type PagesRefused = { ok: false; code: string; message: string; change?: number };
export type PagesDone = { ok: true; designId: string; tabId: string } & PagesAnswer;
type PagesDoor = 'mcp' | 'cli';

const designPath = (id: string) => `/designs/${encodeURIComponent(id)}`;

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

/** The tab a Pages call acts on: the one named, else the design's first tab. Every tab holds pages. */
export async function pagesTabOf(
  api: ApiClient,
  designId: string,
  tabId: string | undefined,
): Promise<{ tabId: string; tab: Tab } | PagesRefused> {
  try {
    const id = tabId ?? (await firstTabId(api, designId));
    if (id === null)
      return { ok: false, code: 'tab_needed', message: 'This design has no tab you can reach.' };
    const { tab } = await api.json<TabResponse>(tabPath(designId, id));
    return { tabId: id, tab };
  } catch (err) {
    // A tab the design does not hold answers a bare 404, which reads as "no such design"; the design is read
    // to name its tabs, as read_design and update_design do.
    if (tabId !== undefined && err instanceof ApiError && err.status === 404) {
      const missing = await missingTab(api, designId, tabId);
      if (missing) return missing;
    }
    return refusedBy(err);
  }
}

// The refusal for a tab id the design does not hold, naming its tabs; null when the design cannot be read either
// (then the design is what is missing) or does hold the tab.
async function missingTab(
  api: ApiClient,
  designId: string,
  tabId: string,
): Promise<PagesRefused | null> {
  try {
    const { design } = await api.json<DesignResponse>(designPath(designId));
    const tabs = design.tabs.filter((t) => !t.outOfScope);
    if (tabs.some((t) => t.id === tabId)) return null;
    return {
      ok: false,
      code: 'unknown_tab',
      message: `No tab "${tabId}" in this design. Tabs: ${tabs.map((t) => `${t.name} (${t.id})`).join(', ')}.`,
    };
  } catch {
    return null;
  }
}

async function firstTabId(api: ApiClient, designId: string): Promise<string | null> {
  const { design } = await api.json<DesignResponse>(designPath(designId));
  const [first] = design.tabs
    .filter((t) => !t.outOfScope)
    .sort((a, b) => a.orderIndex - b.orderIndex);
  return first?.id ?? null;
}

async function send(
  api: ApiClient,
  designId: string,
  tabId: string,
  body: { pages: PageChange[] },
  door: PagesDoor,
): Promise<PagesDone | PagesRefused> {
  try {
    const answer = await api.json<PagesAnswer>(`${tabPath(designId, tabId)}/pages`, {
      method: 'POST',
      headers: { [CLIENT_HEADER]: door },
      body: JSON.stringify(body),
    });
    return { ok: true, designId, tabId, ...answer };
  } catch (err) {
    return refusedBy(err);
  }
}

/** change_pages / `page set`: up to 50 page changes as one edit. */
export async function changePages(
  api: ApiClient,
  designId: string,
  input: { tabId?: string; changes: PageChange[] },
  door: PagesDoor,
): Promise<PagesDone | PagesRefused> {
  const found = await pagesTabOf(api, designId, input.tabId);
  if ('ok' in found) return found;
  return send(api, designId, found.tabId, { pages: input.changes }, door);
}
