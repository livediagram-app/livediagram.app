// A rule's snapshot steps on the item's own snapshots (blueprint item-engine.md "The kit": snapshots;
// liveworkspace/docs/specs/018-automations/automations.md "Revert to Snapshot"). Bound by the app to
// @liveworkspace/snapshots through the same door a person's requests use, so a rule's revert is the ordinary one: the
// safety snapshot first, the content replaced, the generation advanced, and every open editor closed onto the
// reverted item. This module holds what every app says of it.
import type { ItemWord } from '../../item';
import type { AutomationPerson } from '../../types';
import type { ItemRoomKit, SnapshotDone } from '../item/kit';

export const snapshotTooLargeWords = (itemWord: ItemWord): string =>
  `the ${itemWord} is too large to snapshot`;
export const snapshotNotStartedWords = (itemWord: ItemWord): string =>
  `the ${itemWord} has nothing to keep yet`;
export const SNAPSHOT_UNREADABLE = 'the snapshot can no longer be read';

// The app's snapshots, as @liveworkspace/snapshots/server and its own door give them.
export interface KitSnapshotsInput {
  itemWord: ItemWord;
  // `listSnapshots(db, itemId)`.
  list(): Promise<readonly { id: string; name: string | null }[]>;
  // The door's `exportFile`: the item's file, or null for an item not started.
  exportFile(): Promise<string | null>;
  // The door's `kept`: the snapshots the item's rules name.
  kept(): Promise<readonly string[]> | readonly string[];
  // `takeSnapshot(db, { itemId, text, name, kind: 'manual', author, keptIds })`.
  take(input: {
    text: string;
    name: string;
    author: AutomationPerson;
    keptIds: readonly string[];
  }): Promise<{ ok: boolean }>;
  // `revertToSnapshot({ db, itemId, snapshotId, door, author })`.
  revert(
    snapshotId: string,
    author: AutomationPerson,
  ): Promise<{ ok: true } | { ok: false; reason: string }>;
}

export function kitSnapshots(input: KitSnapshotsInput): ItemRoomKit['snapshots'] {
  const tooLarge = snapshotTooLargeWords(input.itemWord);
  const notStarted = snapshotNotStartedWords(input.itemWord);
  const reasons: Readonly<Record<string, string>> = {
    item_missing: notStarted,
    unreadable: SNAPSHOT_UNREADABLE,
    too_large: tooLarge,
  };
  return {
    list: async () => (await input.list()).map((s) => ({ id: s.id, name: s.name })),
    take: async (name, author): Promise<SnapshotDone> => {
      const text = await input.exportFile();
      if (text === null) return { ok: false, reason: notStarted };
      const taken = await input.take({ text, name, author, keptIds: await input.kept() });
      return taken.ok ? { ok: true } : { ok: false, reason: tooLarge };
    },
    revert: async (id, author): Promise<SnapshotDone> => {
      const result = await input.revert(id, author);
      if (result.ok) return { ok: true };
      // `snapshot_missing` is the engine's word for a snapshot that is gone.
      return { ok: false, reason: reasons[result.reason] ?? result.reason };
    },
  };
}
