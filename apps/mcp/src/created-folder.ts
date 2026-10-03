// The folder create_document reports (docs/specs/015-api/mcp-server.md §4.3,
// docs/specs/013-workspace/default-folders.md): "My documents" for a document left at the root of
// the user's My documents; the name of the default folder the server filed it in otherwise.

import { ApiError, apiJson } from './api';
import type { Env } from './env';

export const ROOT_FOLDER = 'My documents';
/** Said when the default folder's name cannot be read: the document is filed, the name unknown. */
export const UNNAMED_DEFAULT_FOLDER = 'your default folder';

type Folders = { folders?: { id: string; name: string }[] };

export async function createdFolderLabel(
  env: Env,
  token: string,
  created: { folderId?: string | null; teamId?: string | null } | undefined,
): Promise<string> {
  const folderId = created?.folderId;
  if (!folderId) return ROOT_FOLDER;
  // Personal folders list at /folders; a team's at its library, which only a joined member reads.
  const path = created.teamId ? `/teams/${encodeURIComponent(created.teamId)}/library` : '/folders';
  try {
    const { folders } = await apiJson<Folders>(env, token, path);
    const name = folders?.find((f) => f.id === folderId)?.name;
    if (name) return name;
    console.warn('[mcp] create_document folder lookup failed status=missing');
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 'network';
    console.warn(`[mcp] create_document folder lookup failed status=${status}`);
  }
  return UNNAMED_DEFAULT_FOLDER;
}
