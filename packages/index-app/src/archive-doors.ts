// Archived for an API client (the MCP server's archive and unarchive tools, the CLI's, any script with an `lwt_` token):
// `POST /api/<collection>/:id/archive` and `POST /api/<collection>/:id/unarchive`, passed to the index as the caller
// (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Archived"). The index decides: only the owner archives
// (403 `not_owner` for a teammate), a trashed item is refused (409 `trashed`), and archiving one already archived
// answers it as it is. Moving out is the index's PATCH naming where it goes: `{folderId, teamId}`, each optional, both
// null (the top of My Work) when the body names neither.

import type { IndexClient, Item } from '@liveworkspace/index-client';

export type ArchiveDoor = 'archive' | 'unarchive';

// Which door a request is: `POST /api/<collection>/:id/archive` or `/unarchive`, else null.
export function archiveDoorOf(segments: readonly string[], method: string): ArchiveDoor | null {
  if (segments.length !== 4 || method !== 'POST' || !segments[2]) return null;
  const door = segments[3];
  return door === 'archive' || door === 'unarchive' ? door : null;
}

// Where an unarchive goes.
export type UnarchiveTo = { folderId: string | null; teamId: string | null };

const place = (v: unknown): v is string | null | undefined =>
  v === undefined || v === null || (typeof v === 'string' && v !== '');

// The unarchive body `{folderId?, teamId?}` (anything else in it is ignored), or null for one the index would refuse.
export function unarchiveToOf(body: Record<string, unknown>): UnarchiveTo | null {
  const { folderId, teamId } = body;
  if (!place(folderId) || !place(teamId)) return null;
  return { folderId: folderId ?? null, teamId: teamId ?? null };
}

// Through the door: the item as it is now, an `{error}` for a body that is no destination, or the index's refusal,
// thrown (IndexError) for the app to answer as it answers every index refusal.
export async function throughArchiveDoor(
  client: IndexClient,
  door: ArchiveDoor,
  id: string,
  body: Record<string, unknown>,
): Promise<Item | { error: 'invalid_body' }> {
  if (door === 'archive') return (await client.archiveItem(id)).item;
  const to = unarchiveToOf(body);
  if (!to) return { error: 'invalid_body' };
  return (await client.updateItem(id, to)).item;
}
