// What one pass carries between its inbound and outbound halves: the live
// snapshot (updated as effects land), the item rows waiting to reach D1, and
// the dependencies both halves call.

import type { DriveItem } from '@livediagram/api-schema';
import { ApiError } from '../api/core';
import { DRIVE_ITEMS_PUT_BATCH } from './cadence';
import { driveLog } from './log';
import type { DriveClient } from './drive-client';
import type { LivediagramPort } from './livediagram-port';
import { putSnapshotItem, type MirrorSnapshot } from './snapshot';
import type { Rasteriser } from './thumbnail';

export type DriveTelemetry = (action: 'Applied', type: string) => void;

export class PassContext {
  private pending = new Map<string, DriveItem>();
  readonly snapshot: MirrorSnapshot;
  readonly port: LivediagramPort;
  readonly drive: DriveClient;
  readonly rasterise: Rasteriser;
  readonly track: DriveTelemetry;
  readonly now: () => number;

  constructor(deps: {
    snapshot: MirrorSnapshot;
    port: LivediagramPort;
    drive: DriveClient;
    rasterise: Rasteriser;
    track: DriveTelemetry;
    now: () => number;
  }) {
    this.snapshot = deps.snapshot;
    this.port = deps.port;
    this.drive = deps.drive;
    this.rasterise = deps.rasterise;
    this.track = deps.track;
    this.now = deps.now;
  }

  // Record an item: in the snapshot at once, in D1 with the next batch.
  async record(item: DriveItem): Promise<void> {
    putSnapshotItem(this.snapshot, item);
    this.pending.set(`${item.kind}:${item.ldId}`, item);
    if (this.pending.size >= DRIVE_ITEMS_PUT_BATCH) await this.flushItems();
  }

  // An item this pass knows D1 already dropped (a purge, a folder delete).
  discard(kind: DriveItem['kind'], ldId: string): void {
    this.pending.delete(`${kind}:${ldId}`);
  }

  async flushItems(): Promise<void> {
    if (this.pending.size === 0) return;
    const batch = [...this.pending.values()];
    this.pending = new Map();
    try {
      await this.port.putItems(batch);
    } catch (err) {
      if (!(err instanceof ApiError && err.status === 409)) throw err;
      // A row still names a Drive file one of these now holds (a file
      // re-created, a folder adopted): drop the stale rows, then retry once.
      const files = new Map(batch.map((i) => [i.driveFileId, `${i.kind}:${i.ldId}`]));
      for (const row of await this.port.listItems()) {
        const holder = files.get(row.driveFileId);
        if (holder && holder !== `${row.kind}:${row.ldId}`) {
          driveLog('item-conflict', { kind: row.kind, ldId: row.ldId, fileId: row.driveFileId });
          await this.port.deleteItem(row.kind, row.ldId);
        }
      }
      await this.port.putItems(batch);
    }
  }
}
