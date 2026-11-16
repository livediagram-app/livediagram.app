// Canvas suggestions from the editor (liveworkspace/docs/specs/015-suggestions/canvas-suggestions.md "The api"): the
// shared client (@liveworkspace/suggestions/client) over this editor's request funnel, as the person or share link it
// runs as.
import { suggestionsClient, type SuggestionsClient } from '@liveworkspace/suggestions/client';
import type { Element } from '@livediagram/document';
import { API_BASE, apiFetch, apiHeaders } from './core';

export function apiSuggestionsClient(
  ownerId: string,
  itemId: string,
  shareCode: string | null,
): SuggestionsClient<Element> {
  return suggestionsClient<Element>(async (path, { method, body }) =>
    apiFetch(`${API_BASE}/documents/${encodeURIComponent(itemId)}/${path}`, {
      method,
      headers: await apiHeaders(ownerId, {
        share: shareCode,
        ...(body === undefined ? {} : { body: true }),
      }),
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
  );
}
