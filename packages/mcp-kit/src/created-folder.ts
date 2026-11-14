// The folder an MCP's create tool reports (each product's docs/specs/015-api/mcp-server.md section 4.3 and
// docs/specs/013-workspace/default-folders.md): "My Work" for an item left at the root of the user's My Work; the
// name of the default folder the server filed it in otherwise.

import { ApiError, type ApiClient } from '@liveworkspace/api-client';

const ROOT_FOLDER = 'My Work';
/** Said when the default folder's name cannot be read: the item is filed, the name unknown. */
const UNNAMED_DEFAULT_FOLDER = 'your default folder';

type Folders = { folders?: { id: string; name: string }[] };

/**
 * The label for where `created` was filed, read through the caller's own api client. `tool` names the create tool in
 * the warning a failed lookup logs (`create_document`, ...).
 */
export async function createdFolderLabel(
  client: Pick<ApiClient, 'json'>,
  created: { folderId?: string | null; teamId?: string | null } | undefined,
  tool: string,
): Promise<string> {
  const folderId = created?.folderId;
  if (!folderId) return ROOT_FOLDER;
  // Personal folders list at /folders; a team's at its library, which only a joined member reads.
  const path = created.teamId ? `/teams/${encodeURIComponent(created.teamId)}/library` : '/folders';
  try {
    const { folders } = await client.json<Folders>(path);
    const name = folders?.find((f) => f.id === folderId)?.name;
    if (name) return name;
    console.warn(`[mcp] ${tool} folder lookup failed status=missing`);
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 'network';
    console.warn(`[mcp] ${tool} folder lookup failed status=${status}`);
  }
  return UNNAMED_DEFAULT_FOLDER;
}
