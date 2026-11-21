// A rule's snapshot steps on the design's own snapshots (blueprint automations.md "The kit": snapshots;
// liveworkspace/docs/specs/018-automations/automations.md "Revert to Snapshot"; docs/specs/013-workspace/snapshots.md).
// The platform's binding (@liveworkspace/automations/room kitSnapshots) over @liveworkspace/snapshots and the same
// door a person's requests use (design-snapshots.ts), so a rule's revert is the ordinary one: the safety snapshot
// first, the content replaced, the generation advanced, and every open editor closed onto the reverted design.
import { KINDS } from '@livedesign/design/automations';
import {
  kitSnapshots as itemKitSnapshots,
  type ItemRoomKit,
} from '@liveworkspace/automations/room';
import { listSnapshots, revertToSnapshot, takeSnapshot } from '@liveworkspace/snapshots/server';
import type { DesignEnv } from '../../types';
import { designSnapshotDoor } from '../design-snapshots';

export function kitSnapshots(env: DesignEnv, designId: string): ItemRoomKit['snapshots'] {
  const db = env.DESIGN_DB;
  const door = () => designSnapshotDoor(env, designId);
  return itemKitSnapshots({
    itemWord: KINDS.itemWord,
    list: () => listSnapshots(db, designId),
    exportFile: () => door().exportFile(),
    kept: async () => (await door().kept?.()) ?? [],
    take: (taken) => takeSnapshot(db, { itemId: designId, kind: 'manual', ...taken }),
    revert: (snapshotId, author) =>
      revertToSnapshot({ db, itemId: designId, snapshotId, door: door(), author }),
  });
}
