// Reading a flat folder list as a tree: the indexes a recursive renderer
// needs, the chain from the root down to one folder, and the ids of a
// folder's whole subtree.
//
// The personal Explorer (useExplorerState) and the team library
// (useTeamLibrary) each had their own copy of the indexing and the
// breadcrumb walk, byte for byte. The team copy even said so, in a comment
// reading "same shape as the personal explorer's". Two folder trees over the
// same `Folder` type, so one module and two callers.
//
// All three are pure functions of the list; the hooks keep the memoisation,
// since only they know when `folders` changed.

import type { Folder } from '@livediagram/api-schema';

export type FolderIndex = {
  // Every folder by id, so a walk up the parents doesn't rescan the list.
  folderById: Map<string, Folder>;
  // Children per parent id (null = root), so the recursive renderer is O(1)
  // per node instead of filtering the whole list at every level.
  childrenByParent: Map<string | null, Folder[]>;
  rootFolders: Folder[];
};

// Index a flat list both ways. Siblings are sorted by name so the tree reads
// alphabetically at every level, whatever order the API returned.
export function indexFolders(folders: readonly Folder[]): FolderIndex {
  const byId = new Map<string, Folder>();
  const byParent = new Map<string | null, Folder[]>();
  for (const f of folders) {
    byId.set(f.id, f);
    const bucket = byParent.get(f.parentId) ?? [];
    bucket.push(f);
    byParent.set(f.parentId, bucket);
  }
  for (const bucket of byParent.values()) bucket.sort((a, b) => a.name.localeCompare(b.name));
  return { folderById: byId, childrenByParent: byParent, rootFolders: byParent.get(null) ?? [] };
}

// The chain root → folderId, for the header and the move-picker rows.
//
// Tolerant of a dangling parentId, which happens mid-refresh between an
// optimistic delete and the server response: the walk simply stops where the
// chain breaks. The `seen` set makes a cycle terminate too, so a bad server
// row can't hang the render.
//
// Returns [] for `all` and the other virtual nodes, which have no folder id.
export function folderBreadcrumb(
  folderById: ReadonlyMap<string, Folder>,
  folderId: string | null,
): Folder[] {
  if (!folderId) return [];
  const chain: Folder[] = [];
  let cursor: Folder | undefined = folderById.get(folderId);
  const seen = new Set<string>();
  while (cursor && !seen.has(cursor.id)) {
    seen.add(cursor.id);
    chain.unshift(cursor);
    cursor = cursor.parentId ? folderById.get(cursor.parentId) : undefined;
  }
  return chain;
}

// Every id at or below `rootId`. Used to hide a folder and its subtree from
// the move-picker: moving a folder into its own descendant would be a cycle.
// The server rejects one anyway, but pre-filtering keeps the UI honest.
//
// Includes `rootId` itself, since moving a folder into itself is the same
// mistake. The `out` check doubles as the cycle guard.
export function folderDescendants(
  childrenByParent: ReadonlyMap<string | null, Folder[]>,
  rootId: string,
): Set<string> {
  const out = new Set<string>([rootId]);
  const stack = [rootId];
  while (stack.length > 0) {
    const cur = stack.pop()!;
    for (const k of childrenByParent.get(cur) ?? [])
      if (!out.has(k.id)) {
        out.add(k.id);
        stack.push(k.id);
      }
  }
  return out;
}
