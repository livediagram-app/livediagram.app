'use client';

// The edits still inside the autosave's debounce when the editor goes (docs/specs/006-project/per-tab-storage.md
// "Saving"), flushed on the way out: the editors' one copy in @liveworkspace/workbench/hooks/persistence/useUnloadFlushCore,
// bound here to this editor's project, its beacon (flushProjectSavesBeacon) and a Participant's room relay.
import type { MutableRefObject, RefObject } from 'react';
import type { Tab } from '@liveplanner/project';
import { flushProjectSavesBeacon, type connectRoom } from '@/lib/api-client';
import { isProjectDeleted } from '@/lib/project-tombstones';
import {
  useUnloadFlushCore,
  type UnloadFlushDeps,
} from '@liveworkspace/workbench/hooks/persistence/useUnloadFlushCore';
import { computeTabSaveDiff } from './editor-page-helpers';
import { relayParticipantChanges } from './tab-save-flow';

export { shouldWarnOnLeave } from '@liveworkspace/workbench/hooks/persistence/useUnloadFlushCore';

type Room = ReturnType<typeof connectRoom>;

const DEPS: UnloadFlushDeps<Tab, Room> = {
  isItemDeleted: (id) => isProjectDeleted(id),
  computeTabSaveDiff: (...args) => computeTabSaveDiff(...args),
  relayParticipantTab: (o, _itemId, before, t) => {
    void relayParticipantChanges(before, t, () => o.roomRef.current).catch(() => {});
  },
  sendBeacon: (o, itemId, { changedTabs, deletedIds, orderChanged, nameChanged }) =>
    flushProjectSavesBeacon({
      ownerId: o.selfId,
      projectId: itemId,
      shareCode: o.sessionShareCode,
      changedTabs,
      deletedIds,
      loadedTabIds: o.loadedTabIdsRef.current,
      orderChanged,
      nameChanged,
      name: o.itemName,
      tabs: o.tabs,
      changesetSeen: o.changesetSeen,
    }),
};

export function useUnloadFlush(opts: {
  hydrated: boolean;
  projectId: string | null;
  isReadOnly: boolean;
  // A Participant's changes go to the open room, never a beacon (docs/specs/013-workspace/share-roles.md).
  participant: boolean;
  tabs: Tab[];
  projectName: string;
  selfId: string;
  sessionShareCode: string | null;
  lastSavedTabsRef: MutableRefObject<Tab[]>;
  lastSavedNameRef: MutableRefObject<string>;
  loadedTabIdsRef: MutableRefObject<Set<string>>;
  changesetSeen: ReadonlyMap<string, number>;
  // Set once the server has refused a write to this project: nothing sent can be accepted.
  writesForbiddenRef: MutableRefObject<boolean>;
  roomRef: RefObject<Room | null>;
}): void {
  const { projectId, projectName, ...rest } = opts;
  useUnloadFlushCore(DEPS, { ...rest, itemId: projectId, itemName: projectName });
}
