// The Knowledgebase Style's save (docs/specs/030-knowledgebase/page-surface.md "Knowledgebase Style"): the
// document's metadata write with `knowledgeStyle` and nothing else, so no name, tab list or page goes with it. A
// knowledgebase kept Offline writes its own record. Editor only: the api refuses anyone else with 403.
import type { KnowledgeStyle } from '@liveknowledge/document';
import { API_BASE, apiFetch, apiHeaders, expectOkVoid } from './core';
import { isOfflineId, offlineSaveKnowledgeStyle } from '../offline/offline-store';

export async function apiSaveKnowledgeStyle(
  ownerId: string,
  documentId: string,
  style: KnowledgeStyle,
  shareCode: string | null = null,
): Promise<void> {
  if (await isOfflineId(documentId)) {
    await offlineSaveKnowledgeStyle(documentId, style, Date.now());
    return;
  }
  // `accent: null` clears a picked accent: the write merges over what is stored.
  const body = JSON.stringify({ knowledgeStyle: { ...style, accent: style.accent ?? null } });
  const res = await apiFetch(`${API_BASE}/documents/${documentId}`, {
    method: 'PUT',
    headers: await apiHeaders(ownerId, { share: shareCode, body: true }),
    body,
  });
  await expectOkVoid(res, 'save knowledgebase style');
}
