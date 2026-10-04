// Agent changesets from the editor (docs/specs/024-agents/agent-changesets.md "In the editor"): the
// toast's Undo is a revert, the same route an agent or the CLI calls.
import { CLIENT_HEADER, type RevertResponse } from '@livediagram/api-schema';
import { API_BASE, apiFetch, apiHeaders, expectOk } from './core';

export async function apiRevertChangeset(
  ownerId: string,
  documentId: string,
  changesetId: string,
  shareCode: string | null,
): Promise<RevertResponse> {
  const res = await apiFetch(
    `${API_BASE}/documents/${documentId}/changesets/${encodeURIComponent(changesetId)}/revert`,
    {
      method: 'POST',
      // Counted as the editor's front door in the Agent telemetry (CS25).
      headers: await apiHeaders(ownerId, {
        share: shareCode,
        extra: { [CLIENT_HEADER]: 'editor' },
      }),
    },
  );
  return expectOk<RevertResponse>(res, 'revert changeset');
}
