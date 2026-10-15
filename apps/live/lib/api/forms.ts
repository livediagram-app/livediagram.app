// A Form tab's link, as its document's people read and change it (docs/specs/030-forms/forms.md "Publishing and the
// form link"). The respondent's side is forms-public.ts, kept apart so the form page loads none of this.
import type { FormLinkResponse } from '@livediagram/api-schema';
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
