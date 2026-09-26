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
// All of them are pure functions of the list; the hooks keep the
// memoisation, since only they know when `folders` changed.
//
// Generic over the row shape: the personal `Folder`, the team sweep's
// `TeamFolderRow` and the move picker's bare nodes all carry the three
// fields a tree needs, so every surface indexes through here rather than
// rebuilding the maps inline.

export type TreeFolder = { id: string; name: string; parentId: string | null };

export type FolderIndex<F extends TreeFolder = TreeFolder> = {
  // Every folder by id, so a walk up the parents doesn't rescan the list.
  folderById: Map<string, F>;
  // Children per parent id (null = root), so the recursive renderer is O(1)
  // per node instead of filtering the whole list at every level.
  childrenByParent: Map<string | null, F[]>;
  rootFolders: F[];
};

// Index a flat list both ways. Siblings are sorted by name so the tree reads
// alphabetically at every level, whatever order the API returned.
export function indexFolders<F extends TreeFolder>(folders: readonly F[]): FolderIndex<F> {
  const byId = new Map<string, F>();
  const byParent = new Map<string | null, F[]>();
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
export function folderBreadcrumb<F extends TreeFolder>(
  folderById: ReadonlyMap<string, F>,
  folderId: string | null,
): F[] {
  if (!folderId) return [];
  const chain: F[] = [];
  let cursor: F | undefined = folderById.get(folderId);
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
  childrenByParent: ReadonlyMap<string | null, readonly TreeFolder[]>,
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

// Rows split by a key, each bucket keeping the input order. The by-team
// splits (the sidebar's and panel's Teams sections) and the by-folder
// diagram buckets below all start here.
export function groupBy<R, K>(rows: readonly R[], keyOf: (r: R) => K): Map<K, R[]> {
  const map = new Map<K, R[]>();
  for (const r of rows) {
    const k = keyOf(r);
    const bucket = map.get(k);
    if (bucket) bucket.push(r);
    else map.set(k, [r]);
  }
  return map;
}

// Diagrams per folder id (null = the root's Unsorted bucket), newest first
// in every bucket: the order every Explorer list shows a folder's contents
// in. `exclude` drops rows before bucketing, for the panel, which keeps
// offline diagrams out of Unsorted because they get their own node.
export function groupDiagramsByFolder<D extends { folderId: string | null; savedAt: number }>(
  diagrams: readonly D[],
  opts: { exclude?: (d: D) => boolean } = {},
): Map<string | null, D[]> {
  const kept = opts.exclude ? diagrams.filter((d) => !opts.exclude!(d)) : diagrams;
  const map = groupBy(kept, (d) => d.folderId);
  for (const bucket of map.values()) bucket.sort((a, b) => b.savedAt - a.savedAt);
  return map;
}
