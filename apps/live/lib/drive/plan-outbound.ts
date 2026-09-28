// Outbound: what Drive must do to match livediagram
// (docs/specs/022-drive-mirror/drive-mirror.md, "Outbound"; blueprint "Outbound").
// Pure: returns ops in the order the engine runs them. Drive parents are
// resolved when an op runs, since a folder created earlier in the same pass
// is the parent of what follows.

import { stripDriveName, type DriveItem } from '@livediagram/api-schema';
import { DRIVE_WRITE_IDLE_MS } from './cadence';
import type { MirrorDiagram, MirrorFolder } from './livediagram-port';
import {
  expectedDiagramParent,
  expectedFolderParent,
  foldersParentsFirst,
  itemKey,
  type MirrorSnapshot,
} from './snapshot';
import type { SeenRow } from './tombstones';

export type OutboundOp =
  | { op: 'create-folder'; folder: MirrorFolder }
  | {
      op: 'update-folder';
      folder: MirrorFolder;
      item: DriveItem;
      rename: boolean;
      move: boolean;
      untrash: boolean;
    }
  | { op: 'create-file'; diagram: MirrorDiagram }
  | {
      op: 'update-file';
      diagram: MirrorDiagram;
      item: DriveItem;
      rename: boolean;
      move: boolean;
      untrash: boolean;
      content: boolean;
    }
  | { op: 'trash-file'; item: DriveItem }
  | { op: 'finish-tombstone'; row: SeenRow };

export type OutboundPlan = { ops: OutboundOp[]; nextDueAt: number | null };

export type OutboundOptions = {
  now: number;
  // A flush writes every changed diagram now, ignoring idle and interval.
  flush: boolean;
  writeIntervalMs: number;
  lastContentWrite: (diagramId: string) => number | undefined;
  seen: SeenRow[];
};

// Drive's name no longer stands for livediagram's: renamed here, a rename
// in Drive that lost a conflict, or a name emptied in Drive (which keeps the
// old one, so Drive gets it back).
function namesDiffer(ldName: string, item: DriveItem): boolean {
  return ldName !== item.ldName || stripDriveName(item.name) === null;
}

export function planOutbound(snapshot: MirrorSnapshot, opts: OutboundOptions): OutboundPlan {
  const ops: OutboundOp[] = [];
  let nextDueAt: number | null = null;

  for (const folder of foldersParentsFirst(snapshot)) {
    const item = snapshot.items.get(itemKey('folder', folder.id));
    if (!item) {
      ops.push({ op: 'create-folder', folder });
      continue;
    }
    const parent = expectedFolderParent(snapshot, folder, item);
    const rename = namesDiffer(folder.name, item);
    const move = parent !== null && parent !== item.parentId;
    if (rename || move || item.trashed) {
      ops.push({ op: 'update-folder', folder, item, rename, move, untrash: item.trashed });
    }
  }

  const diagrams = [...snapshot.diagrams.values()].sort(
    (a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id),
  );
  for (const diagram of diagrams) {
    const item = snapshot.items.get(itemKey('diagram', diagram.id));
    if (!item) {
      ops.push({ op: 'create-file', diagram });
      continue;
    }
    const parent = expectedDiagramParent(snapshot, diagram, item);
    const rename = namesDiffer(diagram.name, item);
    const move = parent !== null && parent !== item.parentId;
    let content = false;
    if (diagram.savedAt > (item.mirroredSavedAt ?? 0)) {
      const last = opts.lastContentWrite(diagram.id);
      const dueAt = opts.flush
        ? opts.now
        : Math.max(
            diagram.savedAt + DRIVE_WRITE_IDLE_MS,
            last === undefined ? 0 : last + opts.writeIntervalMs,
          );
      if (dueAt <= opts.now) content = true;
      else nextDueAt = nextDueAt === null ? dueAt : Math.min(nextDueAt, dueAt);
    }
    if (rename || move || item.trashed || content) {
      ops.push({ op: 'update-file', diagram, item, rename, move, untrash: item.trashed, content });
    }
  }

  // Binned here, or no longer in Personal Space (moved into a team): the file
  // goes to the bin, and the row stays so a way back restores it.
  for (const item of snapshot.items.values()) {
    if (item.kind !== 'diagram' || item.trashed) continue;
    if (!snapshot.diagrams.has(item.ldId)) ops.push({ op: 'trash-file', item });
  }

  // Rows this browser saw that a purge or folder deletion took with it.
  // Folders last: their contents have moved up by now.
  const vanished = opts.seen.filter((row) => {
    if (snapshot.items.has(itemKey(row.kind, row.ldId))) return false;
    if (row.kind === 'diagram')
      return !snapshot.diagrams.has(row.ldId) && !snapshot.trash.has(row.ldId);
    return !snapshot.folders.has(row.ldId);
  });
  vanished.sort((a, b) => Number(a.kind === 'folder') - Number(b.kind === 'folder'));
  for (const row of vanished) ops.push({ op: 'finish-tombstone', row });

  return { ops, nextDueAt };
}
