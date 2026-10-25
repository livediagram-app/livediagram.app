// Folders and placement defaults into the index (docs/migration.md, step 2.3). Folders are written parents first, so
// every parent_id points at a row already there; a parent in another scope (the old site allowed a team folder
// under a person's) is dropped, as the index refuses one.
import type { PlanContext } from './context.ts';
import { scopeOf } from './context.ts';

type Row = Record<string, string | number | null>;

export type FolderInfo = { scope: string };

/** Writes every folder and answers each one's scope, for the documents filed in them. */
export function writeFolders(ctx: PlanContext): Map<string, FolderInfo> {
  const rows = ctx.snapshot.prepare('SELECT * FROM folders ORDER BY id').all() as Row[];
  const byId = new Map(rows.map((r) => [String(r.id), r]));
  const info = new Map<string, FolderInfo>();
  for (const r of rows) {
    const owner = ctx.owners.ownerOf(String(r.owner_id));
    info.set(String(r.id), {
      scope: scopeOf(owner, r.team_id === null ? null : String(r.team_id)),
    });
  }
  // Depth first from each root, in id order: a parent always before its children; a cycle is cut where it closes.
  const done = new Set<string>();
  const visit = (r: Row, path: Set<string>) => {
    const id = String(r.id);
    if (done.has(id)) return;
    const parentId = r.parent_id === null ? null : String(r.parent_id);
    const parent = parentId ? byId.get(parentId) : undefined;
    let keptParent: string | null = null;
    if (parent && !path.has(parentId!)) {
      path.add(id);
      visit(parent, path);
      path.delete(id);
      if (info.get(parentId!)?.scope === info.get(id)?.scope) keptParent = parentId;
    }
    if (parentId && !keptParent) ctx.report.add('folders.parentDropped');
    done.add(id);
    const owner = ctx.owners.ownerOf(String(r.owner_id));
    const teamId = r.team_id === null ? null : String(r.team_id);
    const updatedAt = Number(r.updated_at);
    ctx.sql.index.row({
      table: 'folders',
      key: id,
      columns: [
        'id',
        'name',
        'parent_id',
        'owner_id',
        'team_id',
        'scope',
        'created_at',
        'updated_at',
      ],
      values: [
        id,
        String(r.name),
        keptParent,
        owner,
        teamId,
        info.get(id)!.scope,
        Number(r.created_at),
        updatedAt,
      ],
      conflict: ['id'],
      version: updatedAt,
      guard: 'updated_at',
      update: ['name', 'parent_id', 'owner_id', 'team_id', 'scope', 'updated_at'],
    });
    ctx.report.add('folders');
  };
  for (const r of rows) visit(r, new Set([String(r.id)]));
  return info;
}

export function writePlacementDefaults(
  ctx: PlanContext,
  folders: ReadonlyMap<string, FolderInfo>,
): void {
  const rows = ctx.snapshot.prepare(
    'SELECT owner_id, default_key, folder_id, updated_at FROM placement_defaults ORDER BY owner_id, default_key',
  );
  for (const r of rows.iterate() as Iterable<Row>) {
    const folder = String(r.folder_id);
    if (!folders.has(folder)) {
      ctx.report.skip(
        'placement_default',
        `${String(r.owner_id)}|${String(r.default_key)}`,
        'its folder is gone',
      );
      continue;
    }
    const person = ctx.owners.ownerOf(String(r.owner_id));
    const updatedAt = Number(r.updated_at);
    ctx.sql.index.row({
      table: 'placement_defaults',
      key: `${person}|${String(r.default_key)}`,
      columns: ['person_id', 'default_key', 'folder_id', 'updated_at'],
      values: [person, String(r.default_key), folder, updatedAt],
      conflict: ['person_id', 'default_key'],
      version: updatedAt,
      guard: 'updated_at',
      update: ['folder_id', 'updated_at'],
    });
  }
}
