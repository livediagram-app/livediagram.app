import type { Suggestion, SuggestionsResponse } from '@livehuddle/api-schema';
import { API_BASE, apiFetch, apiHeaders, expectOk, expectOkVoid } from './core';

// A Suggestion Box's notes (docs/specs/009-elements/team-pieces.md "Suggestion Box", "The wire"): drop one (a
// Participant or an Editor), and an Editor's read and remove. The notes never ride the room or the tab, so these are
// their only way in and out. A refused drop's code (`box_full`, `box_closed`) is expected, not an error to report.

const EXPECTED_DROP_REFUSALS = new Set(['box_full', 'box_closed']);

function suggestionsUrl(documentId: string, tabId: string, rest = ''): string {
  return `${API_BASE}/documents/${encodeURIComponent(documentId)}/tabs/${encodeURIComponent(tabId)}/suggestions${rest}`;
}

export async function apiDropSuggestion(
  ownerId: string,
  documentId: string,
  tabId: string,
  elementId: string,
  text: string,
  shareCode: string | null = null,
): Promise<void> {
  const res = await apiFetch(suggestionsUrl(documentId, tabId), {
    method: 'POST',
    headers: await apiHeaders(ownerId, { share: shareCode, body: true }),
    body: JSON.stringify({ elementId, text }),
  });
  await expectOk<Record<string, never>>(res, 'drop suggestion', (code) =>
    code !== null ? EXPECTED_DROP_REFUSALS.has(code) : false,
  );
}

export async function apiListSuggestions(
  ownerId: string,
  documentId: string,
  tabId: string,
  elementId: string,
  shareCode: string | null = null,
): Promise<Suggestion[]> {
  const res = await apiFetch(
    suggestionsUrl(documentId, tabId, `?elementId=${encodeURIComponent(elementId)}`),
    { headers: await apiHeaders(ownerId, { share: shareCode }) },
  );
  return (await expectOk<SuggestionsResponse>(res, 'list suggestions')).suggestions;
}

export async function apiRemoveSuggestion(
  ownerId: string,
  documentId: string,
  tabId: string,
  suggestionId: string,
  shareCode: string | null = null,
): Promise<void> {
  const res = await apiFetch(
    suggestionsUrl(documentId, tabId, `/${encodeURIComponent(suggestionId)}`),
    {
      method: 'DELETE',
      headers: await apiHeaders(ownerId, { share: shareCode }),
    },
  );
  await expectOkVoid(res, 'remove suggestion');
}
