// What one pass carries between its inbound and outbound halves: the snapshot (kept up to date as effects land), the
// person's index, and the row writes, each persisted at once so a pass cut short leaves the rows it did write, and
// the next pass reads its own writes back as echoes.

import {
  buildSnapshot,
  DRIVE_PROP_FOLDER_ID,
  DRIVE_PROP_ORIGIN,
  dropSnapshotRow,
  putSnapshotRow,
  type DriveRow,
  type DriveRowKind,
  type MirrorSnapshot,
} from '@liveworkspace/drive';
import type { Picture, PersonIndex } from '../index-api';
import type { Runtime } from './context';

export class PassState {
  readonly rt: Runtime;
  readonly index: PersonIndex;
  snapshot: MirrorSnapshot;

  constructor(rt: Runtime, index: PersonIndex, snapshot: MirrorSnapshot) {
    this.rt = rt;
    this.index = index;
    this.snapshot = snapshot;
  }

  static build(rt: Runtime, index: PersonIndex, rootFolderId: string, picture: Picture): PassState {
    return new PassState(rt, index, snapshotOf(rt, rootFolderId, picture));
  }

  /** The person's work read again after inbound changed it. */
  async reread(): Promise<Picture> {
    const picture = await this.index.picture();
    this.snapshot = snapshotOf(this.rt, this.snapshot.rootFolderId, picture);
    return picture;
  }

  record(row: DriveRow): void {
    this.rt.guard();
    putSnapshotRow(this.snapshot, row);
    this.rt.deps.store.putRow(row);
  }

  drop(kind: DriveRowKind, id: string): void {
    this.rt.guard();
    dropSnapshotRow(this.snapshot, kind, id);
    this.rt.deps.store.deleteRow(kind, id);
  }

  folderProperties(folderId: string): Record<string, string> {
    return { [DRIVE_PROP_FOLDER_ID]: folderId, [DRIVE_PROP_ORIGIN]: this.rt.deps.origin };
  }
}

function snapshotOf(rt: Runtime, rootFolderId: string, picture: Picture): MirrorSnapshot {
  return buildSnapshot({
    origin: rt.deps.origin,
    rootFolderId,
    items: picture.items,
    folders: picture.folders,
    trash: picture.trash,
    rows: rt.deps.store.rows(),
  });
}

/** A folder and every folder under it, the folder first. */
export function folderSubtree(snapshot: MirrorSnapshot, folderId: string): string[] {
  const children = new Map<string, string[]>();
  for (const f of snapshot.folders.values()) {
    if (f.parentId === null) continue;
    children.set(f.parentId, [...(children.get(f.parentId) ?? []), f.id]);
  }
  const out = [folderId];
  const seen = new Set(out);
  for (let i = 0; i < out.length; i++) {
    for (const child of children.get(out[i]!) ?? []) {
      if (seen.has(child)) continue;
      seen.add(child);
      out.push(child);
    }
  }
  return out;
}
