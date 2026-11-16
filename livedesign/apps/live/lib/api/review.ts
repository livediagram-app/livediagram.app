// The design's review settings (liveworkspace/docs/specs/014-suggestions/canvas-suggestions.md "Suggest Only"): the
// Share dialog's Suggestions section reads and sets them. An Editor's alone; the api refuses anyone else.
import {
  parseStoredReview,
  type ReviewResponse,
  type ReviewSettings,
  type StoredReview,
} from '@livedesign/api-schema';
import { API_BASE, apiFetch, apiHeaders, expectOk } from './core';

// Read defensively: an api from before a field answers without it.
const stored = (r: ReviewResponse): StoredReview => parseStoredReview(JSON.stringify(r.review));

export async function apiReadReview(
  ownerId: string,
  itemId: string,
  shareCode: string | null,
): Promise<StoredReview> {
  const res = await apiFetch(`${API_BASE}/designs/${itemId}/review`, {
    headers: await apiHeaders(ownerId, { share: shareCode }),
  });
  return stored(await expectOk<ReviewResponse>(res, 'read review settings'));
}

export async function apiSetReview(
  ownerId: string,
  itemId: string,
  settings: ReviewSettings,
  shareCode: string | null,
): Promise<StoredReview> {
  const res = await apiFetch(`${API_BASE}/designs/${itemId}/review`, {
    method: 'PUT',
    headers: await apiHeaders(ownerId, { share: shareCode, body: true }),
    body: JSON.stringify(settings),
  });
  return stored(await expectOk<ReviewResponse>(res, 'set review settings'));
}
