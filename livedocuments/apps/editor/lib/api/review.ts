// The document's review settings (docs/specs/007-editor/suggestions.md "Suggest Only"): the Share dialog's
// Suggestions section reads and sets them. An Editor's alone; the api refuses anyone else.
import type { ReviewResponse, ReviewSettings, StoredReview } from '@livedocuments/api-schema';
import { API_BASE, apiFetch, apiHeaders, expectOk } from './core';

export async function apiReadReview(
  ownerId: string,
  documentId: string,
  shareCode: string | null,
): Promise<StoredReview> {
  const res = await apiFetch(`${API_BASE}/documents/${documentId}/review`, {
    headers: await apiHeaders(ownerId, { share: shareCode }),
  });
  return (await expectOk<ReviewResponse>(res, 'read review settings')).review;
}

export async function apiSetReview(
  ownerId: string,
  documentId: string,
  settings: ReviewSettings,
  shareCode: string | null,
): Promise<StoredReview> {
  const res = await apiFetch(`${API_BASE}/documents/${documentId}/review`, {
    method: 'PUT',
    headers: await apiHeaders(ownerId, { share: shareCode, body: true }),
    body: JSON.stringify(settings),
  });
  return (await expectOk<ReviewResponse>(res, 'set review settings')).review;
}
