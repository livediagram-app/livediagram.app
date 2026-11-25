// An agent's Pages calls (docs/specs/024-agents/pages-for-agents.md): change_pages and
// write_article on the MCP, `page set` and `article set` on the CLI, and `article get`. Each finds the
// tab ("Which tab"), sends one request to the pages route, and answers what it did or why not,
// in the same words on both doors.
import { ApiError, type ApiClient } from '@liveworkspace/api-client';
import {
  CLIENT_HEADER,
  type ArticleWrite,
  type DocumentResponse,
  type PagesAnswer,
  type PageChange,
  type TabResponse,
} from '@livedocuments/api-schema';
import { articlesOf, articleTitleOf, articleToMarkdown, type Tab } from '@livedocuments/document';
import { apiRefusalOf } from '../api-refusal';
import { tabPath } from '../verbs/shared';
import { withSavedDesigns } from './saved-designs';

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
    // A tab the document does not hold answers a bare 404, which reads as "no such document"; the document is read
    // to name its tabs, as read_document and update_document do.
    if (tabId !== undefined && err instanceof ApiError && err.status === 404) {
      const missing = await missingTab(api, documentId, tabId);
      if (missing) return missing;
    }
    return refusedBy(err);
  }
}

// The refusal for a tab id the document does not hold, naming its tabs; null when the document cannot be read
// either (then the document is what is missing) or does hold the tab.
async function missingTab(
  api: ApiClient,
  documentId: string,
  tabId: string,
): Promise<PagesRefused | null> {
  try {
    const { document } = await api.json<DocumentResponse>(documentPath(documentId));
    const tabs = document.tabs.filter((t) => !t.outOfScope);
    if (tabs.some((t) => t.id === tabId)) return null;
    return {
      ok: false,
      code: 'unknown_tab',
      message: `No tab "${tabId}" in this document. Tabs: ${tabs.map((t) => `${t.name} (${t.id})`).join(', ')}.`,
    };
  } catch {
    return null;
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
  body: { pages: PageChange[] } | { article: ArticleWrite },
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
  // A design saved to the Library, named `saved:<id>`, goes as the design it holds.
  let resolved: Awaited<ReturnType<typeof withSavedDesigns>>;
  try {
    resolved = await withSavedDesigns(api, input.changes);
  } catch (err) {
    return refusedBy(err);
  }
  if (!resolved.ok) return resolved;
  return send(api, documentId, found.tabId, { pages: resolved.changes }, door);
}

/** write_article / `article set`: an article's text from Markdown. */
export async function writeArticle(
  api: ApiClient,
  documentId: string,
  input: { tabId?: string } & ArticleWrite,
  door: PagesDoor,
): Promise<PagesDone | PagesRefused> {
  const { tabId, ...write } = input;
  const found = await pagesTabOf(api, documentId, tabId);
  if ('ok' in found) return found;
  return send(api, documentId, found.tabId, { article: write }, door);
}

/** `article get`: one article's writing as the Markdown write_article takes. */
// A title as an article is named by, case and spacing aside: the key write_article finds one by (edit-operations
// article-write's nameKey), so `article get` reads the article `article set` writes.
const titleKey = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

export async function readArticle(
  api: ApiClient,
  documentId: string,
  input: { tabId?: string; article?: string },
): Promise<
  { ok: true; tabId: string; flow: string; title: string; markdown: string } | PagesRefused
> {
  const found = await pagesTabOf(api, documentId, input.tabId);
  if ('ok' in found) return found;
  const articles = articlesOf(found.tab);
  const flows = Object.keys(articles);
  const key = input.article === undefined ? '' : titleKey(input.article);
  const flow = key
    ? (flows.find((f) => f === input.article) ??
      flows.find((f) => titleKey(articleTitleOf(articles[f]!)) === key))
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
