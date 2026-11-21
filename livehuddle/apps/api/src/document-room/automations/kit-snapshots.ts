// A rule's snapshot steps on the document's own snapshots (blueprint automations.md "The kit": snapshots;
// liveworkspace/docs/specs/018-automations/automations.md "Revert to Snapshot"; docs/specs/013-workspace/snapshots.md).
// The platform's binding (@liveworkspace/automations/room kitSnapshots) over @liveworkspace/snapshots and the same
// door a person's requests use (document-snapshots.ts), so a rule's revert is the ordinary one: the safety snapshot
// first, the content replaced, the generation advanced, and every open editor closed onto the reverted Space.
import { KINDS } from '@livehuddle/document/automations';
import {
  kitSnapshots as itemKitSnapshots,
  type ItemRoomKit,
} from '@liveworkspace/automations/room';
import { listSnapshots, revertToSnapshot, takeSnapshot } from '@liveworkspace/snapshots/server';
import type { DocumentEnv } from '../../types';
import { documentSnapshotDoor } from '../document-snapshots';

export function kitSnapshots(env: DocumentEnv, documentId: string): ItemRoomKit['snapshots'] {
  const db = env.DOCUMENT_DB;
  const door = () => documentSnapshotDoor(env, documentId);
  return itemKitSnapshots({
    itemWord: KINDS.itemWord,
    list: () => listSnapshots(db, documentId),
    exportFile: () => door().exportFile(),
    kept: async () => (await door().kept?.()) ?? [],
    take: (taken) => takeSnapshot(db, { itemId: documentId, kind: 'manual', ...taken }),
    revert: (snapshotId, author) =>
      revertToSnapshot({ db, itemId: documentId, snapshotId, door: door(), author }),
  });
}
