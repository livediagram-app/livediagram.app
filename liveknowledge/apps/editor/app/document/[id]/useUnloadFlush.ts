'use client';

// The edits still inside the autosave's debounce when the editor goes (docs/specs/006-document/per-tab-storage.md
// "Saving"), flushed on the way out: the editors' one copy in @liveworkspace/workbench/hooks/persistence/useUnloadFlushCore,
// bound here to this editor's document, its beacon (flushDocumentSavesBeacon) and a Participant's room relay.
import type { MutableRefObject, RefObject } from 'react';
import type { Tab } from '@liveknowledge/document';
import { tabSaveChangesHeader } from '@liveknowledge/api-schema';
import { flushDocumentSavesBeacon, type connectRoom } from '@/lib/api-client';
import { isDocumentDeleted } from '@liveworkspace/workbench/lib/document-tombstones';
import {
  useUnloadFlushCore,
  type UnloadFlushDeps,
} from '@liveworkspace/workbench/hooks/persistence/useUnloadFlushCore';
import { computeTabSaveDiff } from './editor-page-helpers';
import { relayParticipantChanges } from './tab-save-flow';

export { shouldWarnOnLeave } from '@liveworkspace/workbench/hooks/persistence/useUnloadFlushCore';

type Room = ReturnType<typeof connectRoom>;

const DEPS: UnloadFlushDeps<Tab, Room, string> = {
  isItemDeleted: (id) => isDocumentDeleted(id),
  computeTabSaveDiff: (...args) => computeTabSaveDiff(...args),
  relayParticipantTab: (o, _itemId, before, t) => {
    void relayParticipantChanges(before, t, () => o.roomRef.current).catch(() => {});
  },
  sendBeacon: (o, itemId, { changedTabs, deletedIds, orderChanged, nameChanged }, saveChanges) =>
    flushDocumentSavesBeacon({
      ownerId: o.selfId,
      documentId: itemId,
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
  documentId: string | null;
  isReadOnly: boolean;
  // A Participant's changes go to the open room, never a beacon (docs/specs/013-workspace/share-roles.md).
  participant: boolean;
  tabs: Tab[];
  documentName: string;
  selfId: string;
  sessionShareCode: string | null;
  lastSavedTabsRef: MutableRefObject<Tab[]>;
  lastSavedNameRef: MutableRefObject<string>;
  loadedTabIdsRef: MutableRefObject<Set<string>>;
  changesetSeen: ReadonlyMap<string, number>;
  // Set once the server has refused a write to this document: nothing sent can be accepted.
  writesForbiddenRef: MutableRefObject<boolean>;
  roomRef: RefObject<Room | null>;
}): void {
  const { documentId, documentName, ...rest } = opts;
  useUnloadFlushCore(DEPS, { ...rest, itemId: documentId, itemName: documentName });
}
