// A Form tab's link, as its document's people read and change it (docs/specs/030-forms/forms.md "Publishing and the
// form link"). The respondent's side is forms-public.ts, kept apart so the form page loads none of this.
import type { FormLinkResponse } from '@liveplanner/api-schema';
import type { AnswerError } from '@liveplanner/forms';
import { API_BASE, apiFetch, apiHeaders, expectOk } from './core';

const linkUrl = (
  documentId: string,
  tabId: string,
  door: 'form-link' | 'form-seen' = 'form-link',
) =>
  `${API_BASE}/documents/${encodeURIComponent(documentId)}/tabs/${encodeURIComponent(tabId)}/${door}`;

async function call(
  ownerId: string,
  documentId: string,
  tabId: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  opts: { share?: string | null; body?: unknown; door?: 'form-link' | 'form-seen' } = {},
): Promise<FormLinkResponse> {
  const res = await apiFetch(linkUrl(documentId, tabId, opts.door), {
    method,
    headers: await apiHeaders(ownerId, {
      share: opts.share ?? null,
      body: opts.body !== undefined,
    }),
    ...(opts.body === undefined ? {} : { body: JSON.stringify(opts.body) }),
  });
  return expectOk<FormLinkResponse>(res, 'form link');
}

export const apiFormLink = (
  ownerId: string,
  documentId: string,
  tabId: string,
  share?: string | null,
) => call(ownerId, documentId, tabId, 'GET', { share });

export const apiPublishForm = (
  ownerId: string,
  documentId: string,
  tabId: string,
  share?: string | null,
) => call(ownerId, documentId, tabId, 'POST', { share });

export const apiSetFormOpen = (
  ownerId: string,
  documentId: string,
  tabId: string,
  open: boolean,
  share?: string | null,
) => call(ownerId, documentId, tabId, 'PUT', { share, body: { open } });

export const apiDeleteFormLink = (
  ownerId: string,
  documentId: string,
  tabId: string,
  share?: string | null,
) => call(ownerId, documentId, tabId, 'DELETE', { share });

export const apiMarkFormSeen = (
  ownerId: string,
  documentId: string,
  tabId: string,
  share?: string | null,
) => call(ownerId, documentId, tabId, 'POST', { share, door: 'form-seen' });

// An Editor's Preview of a published form (docs/specs/030-forms/forms.md "Preview"): sent as a counted response.
// `not_published` when the form has no live link (the editor then makes an uncounted card itself).
export type PreviewSend =
  | { kind: 'sent' }
  | { kind: 'not_published' }
  | { kind: 'invalid'; errors: Record<string, AnswerError> }
  | { kind: 'failed' };

export async function apiSendFormPreview(
  ownerId: string,
  documentId: string,
  tabId: string,
  body: { answers: Record<string, unknown>; other: Record<string, unknown> },
  share?: string | null,
): Promise<PreviewSend> {
  try {
    const res = await apiFetch(
      `${API_BASE}/documents/${encodeURIComponent(documentId)}/tabs/${encodeURIComponent(tabId)}/form-preview`,
      {
        method: 'POST',
        headers: await apiHeaders(ownerId, { share: share ?? null, body: true }),
        body: JSON.stringify(body),
      },
    );
    if (res.status === 201) return { kind: 'sent' };
    const refusal = (await res.json().catch(() => null)) as {
      error?: string;
      errors?: Record<string, AnswerError>;
    } | null;
    if (res.status === 404 && refusal?.error === 'form_not_published')
      return { kind: 'not_published' };
    if (refusal?.error === 'invalid_answers' && refusal.errors)
      return { kind: 'invalid', errors: refusal.errors };
    return { kind: 'failed' };
  } catch {
    return { kind: 'failed' };
  }
}
