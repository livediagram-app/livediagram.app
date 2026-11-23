// The knowledge routes from the editor (docs/specs/015-api/api.md "Knowledge"): search, a page's backlinks, its
// health and verification, the knowledgebase's summary, and the reads and writes the Ask tab, the Insights tab
// and Settings > AI are built over. Each is one request through the shared funnel (identity, the index's grant, the
// release signal, the failure report); the Ask stream is knowledge-ask.ts.
import type {
  KnowledgeAiProvider,
  KnowledgeAiSettings,
  KnowledgeBacklink,
  KnowledgeBacklinksResponse,
  KnowledgeOverviewResponse,
  KnowledgeSearchResponse,
  KnowledgeSearchResult,
  KnowledgeSettingsPreviewResponse,
  KnowledgeSettingsResponse,
  KnowledgeReviewEvery,
  KnowledgeSummaryResponse,
  PageHealthResponse,
  PageKnowledge,
  PageKnowledgePatch,
  PageKnowledgeResponse,
} from '@liveknowledge/api-schema';
// The error's own module, not `./core`: this class is made as the module loads, and `./core` may still be loading
// then (it and the preferences import each other).
import { ApiError } from '@liveworkspace/workbench/lib/api/api-error';
import { API_BASE, apiDelete, apiFetch, apiHeaders, expectOk, expectOkVoid } from './core';

/** Who is asking: the editor's owner id and the share code it arrived by, if any. */
export type KnowledgeCaller = { ownerId: string; shareCode: string | null };

/** How long a knowledge read or write may take before it is given up (a search is replaced by the next one long
 *  before this; the bound is for a request the network swallowed). */
export const KNOWLEDGE_TIMEOUT_MS = 15_000;

// The refusals the interface words itself, so they are not reported as faults.
const EXPECTED = new Set([
  'query_too_long',
  'rate_limited',
  'context_budget',
  'owner_no_access',
  'tab_busy',
  'forbidden',
  'ask_unavailable',
  'invalid_key',
  'invalid_model',
  'no_question',
  'question_too_long',
]);
const expected = (code: string | null) => code !== null && EXPECTED.has(code);

/** Always in Context refused: the page does not fit what is left of the budget every agent is handed. */
export class ContextBudgetError extends ApiError {
  readonly tokens: number;
  readonly used: number;
  readonly budget: number;
  constructor(action: string, sizes: { tokens: number; used: number; budget: number }) {
    super(action, 409, 'context_budget');
    this.name = 'ContextBudgetError';
    this.tokens = sizes.tokens;
    this.used = sizes.used;
    this.budget = sizes.budget;
  }
}

export const knowledgeUrl = (documentId: string, path: string) =>
  `${API_BASE}/documents/${encodeURIComponent(documentId)}/${path}`;
const pageUrl = (documentId: string, tab: string, path: string) =>
  knowledgeUrl(documentId, `pages/${encodeURIComponent(tab)}/${path}`);

export const knowledgeHeaders = (who: KnowledgeCaller, json = false) =>
  apiHeaders(who.ownerId, { share: who.shareCode, body: json });

// The request's own bound, joined to the caller's signal when it has one (a search aborts its last request).
export function knowledgeSignal(signal?: AbortSignal): AbortSignal {
  const timeout = AbortSignal.timeout(KNOWLEDGE_TIMEOUT_MS);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

async function read<T>(
  who: KnowledgeCaller,
  url: string,
  action: string,
  signal?: AbortSignal,
  // `reload`: past the browser's own copy of a cacheable answer, which this read then replaces.
  cache?: RequestCache,
): Promise<T> {
  const res = await apiFetch(url, {
    headers: await knowledgeHeaders(who),
    signal: knowledgeSignal(signal),
    ...(cache ? { cache } : {}),
  });
  return expectOk<T>(res, action, expected);
}

async function write(
  who: KnowledgeCaller,
  url: string,
  method: 'POST' | 'PUT',
  body?: unknown,
): Promise<Response> {
  return apiFetch(url, {
    method,
    headers: await knowledgeHeaders(who, body !== undefined),
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: knowledgeSignal(),
  });
}

/** Search the knowledgebase: page titles first, then passages, 20 at most. Throws `query_too_long` (400) past 200
 *  characters and `rate_limited` (429). `signal` aborts it when the next search starts. */
export async function apiSearchKnowledge(
  who: KnowledgeCaller,
  documentId: string,
  query: string,
  signal?: AbortSignal,
  // Only the pages carrying any of these labels, by id (page-surface.md "The label filter").
  labels: readonly string[] = [],
): Promise<KnowledgeSearchResult[]> {
  const scope = labels.length ? `&labels=${encodeURIComponent(labels.join(','))}` : '';
  const url = knowledgeUrl(documentId, `search?q=${encodeURIComponent(query)}${scope}`);
  return (await read<KnowledgeSearchResponse>(who, url, 'search knowledge', signal)).results;
}

/** The knowledgebase's numbers for Home: page count, health, the pages changed last, the caller's own due pages.
 *  The route's answer may be kept a minute by the browser; `fresh` reads past that copy and replaces it (after a
 *  page was verified from Home, so a reload inside the minute does not list it again). */
export function apiKnowledgeSummary(
  who: KnowledgeCaller,
  documentId: string,
  signal?: AbortSignal,
  fresh = false,
): Promise<KnowledgeSummaryResponse> {
  return read(
    who,
    knowledgeUrl(documentId, 'summary'),
    'read knowledge summary',
    signal,
    fresh ? 'reload' : undefined,
  );
}

/** The pages whose writing links to this one, in tree order. */
export async function apiPageBacklinks(
  who: KnowledgeCaller,
  documentId: string,
  tab: string,
  signal?: AbortSignal,
): Promise<KnowledgeBacklink[]> {
  const url = pageUrl(documentId, tab, 'backlinks');
  return (await read<KnowledgeBacklinksResponse>(who, url, 'read backlinks', signal)).backlinks;
}

/** Page Health: the fields, the state now, Changed since verified, the week's reads. */
export function apiPageHealth(
  who: KnowledgeCaller,
  documentId: string,
  tab: string,
  signal?: AbortSignal,
  opened = false,
): Promise<PageHealthResponse> {
  // `opened`: this read is a person opening the page, which counts as their read (insights.md "Reads").
  const url = pageUrl(documentId, tab, 'health');
  return read(who, opened ? `${url}?opened=1` : url, 'read page health', signal);
}

/** Verify: verified now by the caller, who owns a page with no owner. An Editor with an account; else 403. */
export async function apiVerifyPage(
  who: KnowledgeCaller,
  documentId: string,
  tab: string,
  guest?: string,
): Promise<PageKnowledge> {
  // A guest sends their cursor's name, for "Verified by Bright Marlin (Guest)".
  const res = await write(
    who,
    pageUrl(documentId, tab, 'verify'),
    'POST',
    guest === undefined ? undefined : { name: guest },
  );
  return (await expectOk<PageKnowledgeResponse>(res, 'verify page', expected)).knowledge;
}

/** Set the knowledgebase's Review Period (verification.md "The Review Period"): one row written, every page's due
 *  date following at once. Answers the period as stored. Editor only: anyone else is refused with 403. */
export async function apiSetReviewPeriod(
  who: KnowledgeCaller,
  documentId: string,
  reviewEvery: KnowledgeReviewEvery,
): Promise<KnowledgeReviewEvery> {
  const res = await write(who, knowledgeUrl(documentId, 'knowledge-settings'), 'PUT', {
    reviewEvery,
  });
  const answer = await expectOk<KnowledgeSettingsResponse>(res, 'set review period', expected);
  return answer.knowledgeSettings.reviewEvery;
}

/** How many pages would be Review Due under a Review Period, beside how many are now. Changes nothing. */
export function apiPreviewReviewPeriod(
  who: KnowledgeCaller,
  documentId: string,
  reviewEvery: KnowledgeReviewEvery,
  signal?: AbortSignal,
): Promise<KnowledgeSettingsPreviewResponse> {
  const url = knowledgeUrl(
    documentId,
    `knowledge-settings/preview?reviewEvery=${encodeURIComponent(String(reviewEvery))}`,
  );
  return read(who, url, 'preview review period', signal);
}

/** Set a page's owner or Always in Context. Throws `ContextBudgetError` when the page does not fit
 *  the budget, and `owner_no_access` (400) for an owner who cannot open the knowledgebase. */
export async function apiSetPageKnowledge(
  who: KnowledgeCaller,
  documentId: string,
  tab: string,
  patch: PageKnowledgePatch,
): Promise<PageKnowledge> {
  const action = 'set page knowledge';
  const res = await write(who, pageUrl(documentId, tab, 'knowledge'), 'PUT', patch);
  if (res.status === 409) {
    // The refusal's sizes ride its body, which the shared error drops: read them off a copy first.
    const body = (await res
      .clone()
      .json()
      .catch(() => null)) as Record<string, unknown> | null;
    if (body?.error === 'context_budget')
      throw new ContextBudgetError(action, {
        tokens: Number(body.tokens) || 0,
        used: Number(body.used) || 0,
        budget: Number(body.budget) || 0,
      });
  }
  return (await expectOk<PageKnowledgeResponse>(res, action, expected)).knowledge;
}

/** AI Settings: the provider, whether a key is set, its last characters (to an Editor), the model and the models
 *  and providers offered. */
export function apiKnowledgeAi(
  who: KnowledgeCaller,
  documentId: string,
  signal?: AbortSignal,
): Promise<KnowledgeAiSettings> {
  return read(who, knowledgeUrl(documentId, 'ai'), 'read ai settings', signal);
}

/** Add or replace the team's own key for `provider`; another provider than the stored one replaces the key. The key
 *  is sent once and never read back. */
export async function apiSetKnowledgeAiKey(
  who: KnowledgeCaller,
  documentId: string,
  provider: KnowledgeAiProvider,
  key: string,
): Promise<KnowledgeAiSettings> {
  const res = await write(who, knowledgeUrl(documentId, 'ai/key'), 'PUT', { provider, key });
  return expectOk<KnowledgeAiSettings>(res, 'set ai key', expected);
}

export async function apiRemoveKnowledgeAiKey(
  who: KnowledgeCaller,
  documentId: string,
): Promise<KnowledgeAiSettings> {
  const res = await apiFetch(knowledgeUrl(documentId, 'ai/key'), {
    method: 'DELETE',
    headers: await knowledgeHeaders(who),
    signal: knowledgeSignal(),
  });
  return expectOk<KnowledgeAiSettings>(res, 'remove ai key', expected);
}

export async function apiSetKnowledgeAiModel(
  who: KnowledgeCaller,
  documentId: string,
  model: string,
): Promise<KnowledgeAiSettings> {
  const res = await write(who, knowledgeUrl(documentId, 'ai/model'), 'PUT', { model });
  return expectOk<KnowledgeAiSettings>(res, 'set ai model', expected);
}

/** The Insights tab: agents, unanswered questions, conflicts, Always in Context pages, health. */
export function apiKnowledgeOverview(
  who: KnowledgeCaller,
  documentId: string,
  signal?: AbortSignal,
  // With Pro on, the days Most Read covers (tiers.md "AI Knowledge History"); the api clamps it to what is kept.
  days?: number,
): Promise<KnowledgeOverviewResponse> {
  const url = knowledgeUrl(documentId, 'knowledge') + (days ? `?days=${days}` : '');
  return read(who, url, 'read knowledge overview', signal);
}

/** Record a question nobody could answer; answers its group's key. */
export async function apiReportKnowledgeGap(
  who: KnowledgeCaller,
  documentId: string,
  question: string,
): Promise<string> {
  const res = await write(who, knowledgeUrl(documentId, 'questions'), 'POST', { question });
  return (await expectOk<{ key: string }>(res, 'report gap', expected)).key;
}

/** Dismiss an unanswered question. A question already gone is no failure. */
export function apiDismissKnowledgeQuestion(
  who: KnowledgeCaller,
  documentId: string,
  key: string,
): Promise<void> {
  return apiDelete(knowledgeUrl(documentId, `questions/${encodeURIComponent(key)}`), who.ownerId, {
    action: 'dismiss question',
    share: who.shareCode,
  });
}

/** Not a Conflict: the pair is kept dismissed, so it is never raised again. */
export async function apiDismissKnowledgeConflict(
  who: KnowledgeCaller,
  documentId: string,
  id: string,
): Promise<void> {
  const url = knowledgeUrl(documentId, `conflicts/${encodeURIComponent(id)}/dismiss`);
  await expectOkVoid(await write(who, url, 'POST'), 'dismiss conflict');
}
