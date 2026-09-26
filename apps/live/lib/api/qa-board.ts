// The Q&A board's one write path (docs/specs/012-collaboration/qa-board.md). Every role sends every board
// action here, view links included: the server owns the board's state, so it
// is what stamps the author, derives the voter id and sequences the result
// out through the room.
import type { QaAction, QaNote } from '@livediagram/diagram';
import { isOfflineId } from '../offline/offline-store';
import { API_BASE, apiFetch, apiHeaders, expectOk } from './core';

export type QaBoardState = { notes: QaNote[]; rev: number; voterId: string };

// Resolves to the board's authoritative state after the action, or null for an
// offline diagram (docs/specs/006-diagram/offline-mode.md), which has no server: the caller applies the
// action locally and the ordinary tab save persists it.
export async function apiQaAction(
  ownerId: string,
  diagramId: string,
  tabId: string,
  elementId: string,
  action: QaAction,
  shareCode: string | null = null,
): Promise<QaBoardState | null> {
  if (await isOfflineId(diagramId)) return null;
  const res = await apiFetch(
    `${API_BASE}/diagrams/${encodeURIComponent(diagramId)}/tabs/${encodeURIComponent(tabId)}/qa`,
    {
      method: 'POST',
      headers: await apiHeaders(ownerId, { share: shareCode, body: true }),
      body: JSON.stringify({ elementId, action }),
    },
  );
  return expectOk<QaBoardState>(res, 'q&a board');
}
