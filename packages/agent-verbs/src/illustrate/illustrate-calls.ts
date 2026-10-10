// An agent's Illustrate calls (docs/specs/024-agents/illustrate-for-agents.md): change_pages and
// write_article on the MCP, `page set` and `article set` on the CLI, and `article get`. Each finds the
// tab ("Which tab"), sends one request to the illustrate route, and answers what it did or why not,
// in the same words on both doors.
import { ApiError, type ApiClient } from '@livediagram/api-client';
import {
  CLIENT_HEADER,
  type ArticleWrite,
  type DocumentResponse,
  type IllustrateAnswer,
  type PageChange,
  type TabResponse,
} from '@livediagram/api-schema';
import {
  articlesOf,
  articleTitleOf,
  articleToMarkdown,
  opensInOf,
  type Tab,
} from '@livediagram/document';
import { apiRefusalOf } from '../plan/api-refusal';
import { tabPath } from '../verbs/shared';

export type IllustrateRefused = { ok: false; code: string; message: string; change?: number };
export type IllustrateDone = { ok: true; documentId: string; tabId: string } & IllustrateAnswer;
export type IllustrateDoor = 'mcp' | 'cli';

// The most tabs read looking for the first in Illustrate mode.
const TAB_SEARCH_MAX = 20;

const documentPath = (id: string) => `/documents/${encodeURIComponent(id)}`;

const refusedBy = (err: unknown): IllustrateRefused => {
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

/** The tab an Illustrate call acts on: the one named, else the document's first tab in Illustrate
 *  mode. With none, a refusal that says how to get one, so a diagram is never switched unasked. */
export async function illustrateTabOf(
  api: ApiClient,
  documentId: string,
  tabId: string | undefined,
  door: IllustrateDoor,
): Promise<{ tabId: string; tab: Tab } | IllustrateRefused> {
  try {
    if (tabId) {
      const { tab } = await api.json<TabResponse>(tabPath(documentId, tabId));
      return { tabId, tab };
    }
    const { document } = await api.json<DocumentResponse>(documentPath(documentId));
    for (const summary of document.tabs.filter((t) => !t.outOfScope).slice(0, TAB_SEARCH_MAX)) {
      const { tab } = await api.json<TabResponse>(tabPath(documentId, summary.id));
      if (opensInOf(tab) === 'illustrate') return { tabId: summary.id, tab };
    }
  } catch (err) {
    return refusedBy(err);
  }
  return {
    ok: false,
    code: 'tab_needed',
    message:
      door === 'mcp'
        ? 'No tab of this document is in Illustrate mode. Pass tabId to switch one into it, or add_tab with template "blank-illustration" for a new one.'
        : 'No tab of this document is in Illustrate mode. Pass --tab to switch one into it, or add a tab with `tab add --template blank-illustration`.',
  };
}

async function send(
  api: ApiClient,
  documentId: string,
  tabId: string,
  body: { pages: PageChange[] } | { article: ArticleWrite },
  door: IllustrateDoor,
): Promise<IllustrateDone | IllustrateRefused> {
  try {
    const answer = await api.json<IllustrateAnswer>(`${tabPath(documentId, tabId)}/illustrate`, {
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
  door: IllustrateDoor,
): Promise<IllustrateDone | IllustrateRefused> {
  const found = await illustrateTabOf(api, documentId, input.tabId, door);
  if ('ok' in found) return found;
  return send(api, documentId, found.tabId, { pages: input.changes }, door);
}

/** write_article / `article set`: an article's text from Markdown. */
export async function writeArticle(
  api: ApiClient,
  documentId: string,
  input: { tabId?: string } & ArticleWrite,
  door: IllustrateDoor,
): Promise<IllustrateDone | IllustrateRefused> {
  const { tabId, ...write } = input;
  const found = await illustrateTabOf(api, documentId, tabId, door);
  if ('ok' in found) return found;
  return send(api, documentId, found.tabId, { article: write }, door);
}

/** `article get`: one article's writing as the Markdown write_article takes. */
export async function readArticle(
  api: ApiClient,
  documentId: string,
  input: { tabId?: string; article?: string },
  door: IllustrateDoor,
): Promise<
  { ok: true; tabId: string; flow: string; title: string; markdown: string } | IllustrateRefused
> {
  const found = await illustrateTabOf(api, documentId, input.tabId, door);
  if ('ok' in found) return found;
  const articles = articlesOf(found.tab);
  const flows = Object.keys(articles);
  const key = input.article?.trim().toLowerCase();
  const flow = key
    ? (flows.find((f) => f === input.article) ??
      flows.find((f) => articleTitleOf(articles[f]!).toLowerCase() === key))
    : flows.length === 1
      ? flows[0]
      : undefined;
  if (!flow) {
    const listed = flows.map((f) => `"${articleTitleOf(articles[f]!)}" (${f})`).join(', ');
    return {
      ok: false,
      code: flows.length > 1 && !key ? 'article_ambiguous' : 'article_unknown',
      message: flows.length ? `Name an article: ${listed}.` : 'That tab has no article.',
    };
  }
  return {
    ok: true,
    tabId: found.tabId,
    flow,
    title: articleTitleOf(articles[flow]!),
    markdown: articleToMarkdown(articles[flow]!),
  };
}
