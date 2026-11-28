// Describe a Page's call (docs/specs/007-editor/describe-a-page.md; blueprint "The editor"): `POST /api/page-drafts`
// with the person's words, answered with what the next page holds. A refusal the api names throws a
// PageDraftRefusal carrying its fixed words (and, for a key that failed, whose key and how, for the source line; for
// the month's AI credits, its numbers); anything else throws as a failure the dialog says in its own words. Aborted
// with its signal when the dialog is cancelled.
import { readAiKeyFailure, type AiKeyFailure } from '@liveworkspace/ai/key-failure';
import {
  PAGE_DRAFT_ERRORS,
  PAGE_DRAFTS_PATH,
  type PageDraftError,
  type PageDraftRequest,
  type PageDraftResponse,
} from '@livedocuments/api-schema';
import { API_BASE, apiFetch, apiHeaders, expectOk } from './core';

export class PageDraftRefusal extends Error {
  readonly status: number;
  readonly code: PageDraftError;
  // `ai_key_failed`: whose key failed and how (never the key).
  readonly aiKey: AiKeyFailure | null;
  constructor(status: number, code: PageDraftError, message: string, aiKey: AiKeyFailure | null) {
    super(message);
    this.name = 'PageDraftRefusal';
    this.status = status;
    this.code = code;
    this.aiKey = aiKey;
  }
}

const isCode = (v: unknown): v is PageDraftError =>
  typeof v === 'string' && (PAGE_DRAFT_ERRORS as readonly string[]).includes(v);

async function refusalOf(res: Response): Promise<PageDraftRefusal | null> {
  const body = (await res
    .clone()
    .json()
    .catch(() => null)) as { error?: unknown; message?: unknown } | null;
  if (!body || !isCode(body.error) || typeof body.message !== 'string') return null;
  return new PageDraftRefusal(res.status, body.error, body.message, readAiKeyFailure(body));
}

/** Asks for the next page as `accountId` (their account's token rides apiHeaders). */
export async function draftPage(
  accountId: string,
  request: PageDraftRequest,
  signal: AbortSignal,
): Promise<PageDraftResponse> {
  const res = await apiFetch(`${API_BASE}/${PAGE_DRAFTS_PATH}`, {
    method: 'POST',
    headers: await apiHeaders(accountId, { body: true }),
    body: JSON.stringify(request),
    signal,
  });
  if (!res.ok) {
    const refusal = await refusalOf(res);
    if (refusal) throw refusal;
  }
  return expectOk<PageDraftResponse>(res, 'describe a page');
}
