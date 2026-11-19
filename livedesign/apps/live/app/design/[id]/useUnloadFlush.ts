'use client';

// The edits still inside the autosave's debounce when the editor goes (docs/specs/006-design/per-tab-storage.md
// "Saving"), flushed on the way out: the editors' one copy in @liveworkspace/workbench/hooks/persistence/useUnloadFlushCore,
// bound here to this editor's design, its beacon (flushDesignSavesBeacon) and a Participant's room relay, which
// claims the pictures they place first with a keepalive request, unawaited (docs/specs/009-elements/images.md
// "Placement grants").
import type { MutableRefObject, RefObject } from 'react';
import type { Tab } from '@livedesign/design';
import { tabSaveChangesHeader } from '@livedesign/api-schema';
import {
  claimPlacedImagesOnUnload,
  flushDesignSavesBeacon,
  type connectRoom,
} from '@/lib/api-client';
import { placedImageIds } from '@liveworkspace/media';
import { isDesignDeleted } from '@/lib/design-tombstones';
import {
  useUnloadFlushCore,
  type UnloadFlushDeps,
} from '@liveworkspace/workbench/hooks/persistence/useUnloadFlushCore';
import { computeTabSaveDiff } from './editor-page-helpers';
import { participantElementOps, relayParticipantChanges } from './tab-save-flow';

export { shouldWarnOnLeave } from '@liveworkspace/workbench/hooks/persistence/useUnloadFlushCore';

type Room = ReturnType<typeof connectRoom>;

const DEPS: UnloadFlushDeps<Tab, Room, string> = {
  isItemDeleted: (id) => isDesignDeleted(id),
  computeTabSaveDiff: (...args) => computeTabSaveDiff(...args),
  relayParticipantTab: (o, itemId, before, t) => {
    claimPlacedImagesOnUnload(
      o.selfId,
      itemId,
      placedImageIds(participantElementOps(before, t)),
      o.sessionShareCode,
    );
    void relayParticipantChanges(before, t, () => o.roomRef.current).catch(() => {});
  },
  sendBeacon: (o, itemId, { changedTabs, deletedIds, orderChanged, nameChanged }, saveChanges) =>
    flushDesignSavesBeacon({
      ownerId: o.selfId,
      designId: itemId,
      shareCode: o.sessionShareCode,
      changedTabs,
      deletedIds,
      loadedTabIds: o.loadedTabIdsRef.current,
      orderChanged,
      nameChanged,
      name: o.itemName,
      tabs: o.tabs,
      changesetSeen: o.changesetSeen,
      saveChanges,
    }),
  // What each save changed by id, as the debounced save sends it (tab-save-flow.ts PreparedTabSave).
  saveChanges: (before, t) => tabSaveChangesHeader(before, t),
};

export function useUnloadFlush(opts: {
  hydrated: boolean;
  designId: string | null;
  isReadOnly: boolean;
  // A Participant's changes go to the open room, never a beacon (docs/specs/013-workspace/share-roles.md).
  participant: boolean;
  tabs: Tab[];
  designName: string;
  selfId: string;
  sessionShareCode: string | null;
  lastSavedTabsRef: MutableRefObject<Tab[]>;
  lastSavedNameRef: MutableRefObject<string>;
  loadedTabIdsRef: MutableRefObject<Set<string>>;
  changesetSeen: ReadonlyMap<string, number>;
  // Set once the server has refused a write to this design: nothing sent can be accepted.
  writesForbiddenRef: MutableRefObject<boolean>;
  roomRef: RefObject<Room | null>;
}): void {
  const { designId, designName, ...rest } = opts;
  useUnloadFlushCore(DEPS, { ...rest, itemId: designId, itemName: designName });
}
