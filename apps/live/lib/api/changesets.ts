// Agent changesets from the editor (docs/specs/024-agents/agent-changesets.md "In the editor"): the
// toast's Undo is a revert, the same route an agent or the CLI calls.
import { CLIENT_HEADER, type ChangesetSummary, type RevertResponse } from '@livediagram/api-schema';
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

// The document's newest changesets (CHANGESET_LIST_DEFAULT of them), for the editor's check on joining
// its room: one that landed between the tab load and the join was never relayed to it.
export async function apiListChangesets(
  ownerId: string,
  documentId: string,
  shareCode: string | null,
): Promise<ChangesetSummary[]> {
  const res = await apiFetch(`${API_BASE}/documents/${documentId}/changesets`, {
    headers: await apiHeaders(ownerId, { share: shareCode }),
  });
  return (await expectOk<{ changesets: ChangesetSummary[] }>(res, 'list changesets')).changesets;
}
