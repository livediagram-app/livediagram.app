import type { Dispatch, MutableRefObject, RefObject, SetStateAction } from 'react';
import { photoUploads } from '@/lib/photo-editor/upload-queue';
import type { Tab } from '@livedesign/design';
import {
  apiSavedTabDigest,
  apiClaimPlacedImages,
  apiDeleteTab,
  apiSaveDesignMeta,
  apiSaveTab,
  connectRoom,
  reportSaveFailure,
} from '@/lib/api-client';
import type { SaveStatus } from '@/components/chrome/EditorHeader';
import {
  useAutosaveCore,
  type AutosaveDeps,
  type AutosaveUnloadArgs,
} from '@liveworkspace/workbench/hooks/persistence/useAutosaveCore';
import { saveFailureStatus } from '@liveworkspace/workbench/lib/api/save-failure';
import { isDesignDeleted } from '@/lib/design-tombstones';
import { isDesignTrashedError } from '@/lib/design-trashed';
import { computeTabSaveDiff } from './editor-page-helpers';
import { prepareTabSave, relayParticipantChanges, saveTabAndRelay } from './tab-save-flow';
import type { OwnElementWrites } from './own-element-writes';
import {
  SAVE_RESAVE_GRACE_MS,
  baselineAfterSave,
  closeSaveWindow,
  openSaveWindow,
  tabsChangedByPeersSince,
  type RemoteOpJournal,
} from './save-baseline';
import { createTabSaveQueue } from '@liveworkspace/workbench/lib/tab-save-queue';
import { useUnloadFlush } from './useUnloadFlush';
import { sampleSaveTiming, startEditorTiming } from '@/lib/timing';
import { noteTabSaved } from '@liveworkspace/workbench/lib/tab-saved';

type Room = ReturnType<typeof connectRoom>;

// The unload flush (useUnloadFlush) under this editor's names for the design.
function useUnloadFlushFor(a: AutosaveUnloadArgs<Tab, Room>): void {
  useUnloadFlush({
    hydrated: a.hydrated,
    designId: a.itemId,
    isReadOnly: a.isReadOnly,
    participant: a.participant,
    tabs: a.tabs,
    designName: a.itemName,
    selfId: a.selfId,
    sessionShareCode: a.sessionShareCode,
    lastSavedTabsRef: a.lastSavedTabsRef,
    lastSavedNameRef: a.lastSavedNameRef,
    loadedTabIdsRef: a.loadedTabIdsRef,
    changesetSeen: a.changesetSeen,
    writesForbiddenRef: a.writesForbiddenRef,
    roomRef: a.roomRef,
  });
}

// This editor's calls, read at call time (tests mock the modules they come from), and its drifts from the shared
// autosave (@liveworkspace/workbench/hooks/persistence/useAutosaveCore).
const DEPS: AutosaveDeps<
  Tab,
  ReturnType<typeof prepareTabSave>,
  Room,
  RemoteOpJournal,
  OwnElementWrites,
  SaveStatus
> = {
  apiSaveTab: (...args) => apiSaveTab(...args),
  apiDeleteTab: (...args) => apiDeleteTab(...args),
  apiSaveMeta: (...args) => apiSaveDesignMeta(...args),
  metaKind: 'design-meta',
  reportSaveFailure: (err) => reportSaveFailure(err),
  saveFailureStatus: (err) => saveFailureStatus(err),
  isItemDeleted: (id) => isDesignDeleted(id),
  isItemTrashedError: (err) => isDesignTrashedError(err),
  computeTabSaveDiff: (...args) => computeTabSaveDiff(...args),
  prepareTabSave: (...args) => prepareTabSave(...args),
  relayParticipantChanges: (...args) => relayParticipantChanges(...args),
  // Each landed save is announced with its digest, so a peer's next save can be a delta (delta-saves.md).
  saveTabAndRelay: (before, tab, room, put, prepared) =>
    saveTabAndRelay(before, tab, room, put, prepared, (tabId, rev) =>
      apiSavedTabDigest(tabId, rev),
    ),
  baseline: {
    open: (journal) => openSaveWindow(journal),
    close: (journal) => closeSaveWindow(journal),
    after: (...args) => baselineAfterSave(...args),
    changedByPeersSince: (...args) => tabsChangedByPeersSince(...args),
    graceMs: SAVE_RESAVE_GRACE_MS,
  },
  createTabSaveQueue: () => createTabSaveQueue(),
  useUnloadFlush: useUnloadFlushFor,
  startEditorTiming: (name) => startEditorTiming(name),
  sampleSaveTiming: () => sampleSaveTiming(),
  // A Participant claims the pictures it places first (docs/specs/009-elements/images.md "Placement grants").
  claimPlacedImages: (...args) => apiClaimPlacedImages(...args),
  // Each tab's save is prepared against its last one too, which may still be in flight (tab-save-flow.ts
  // PreparedTabSave), and sends its changes.
  trackPrevious: true,
  // A photo's pixels go first: the save never names a blob the store lacks
  // (docs/specs/031-photo/photo-store.md "Committing an edit").
  beforeTabPut: (tabId) => (photoUploads.pending(tabId) ? photoUploads.whenSettled(tabId) : null),
  notesRevisions: true,
  // A sheet made on this tab may be waiting for it to exist on the server (@liveworkspace/workbench/lib/tab-saved.ts).
  noteTabSaved: (id, tabId) => noteTabSaved(id, tabId),
};

// Per-tab autosave (docs/specs/006-design/per-tab-storage.md), lifted out of editor-page.tsx. Two effects:
// a debounced (600ms) save and a beforeunload flush so a fast edit ->
// reload doesn't lose changes. Both diff via the tested computeTabSaveDiff
// kernel. The last-saved mirror refs live in the page (the hydration
// effect seeds them) and are passed in, as are the realtime room ref and
// the status/list setters.
export function useAutosave(opts: {
  hydrated: boolean;
  designId: string | null;
  isReadOnly: boolean;
  tabs: Tab[];
  designName: string;
  selfId: string;
  sessionShareCode: string | null;
  lastSavedTabsRef: MutableRefObject<Tab[]>;
  lastSavedNameRef: MutableRefObject<string>;
  // The set of tabs whose content is authoritative in memory (hydrated /
  // fetched / locally-created). Gates the content-write diff so a never-
  // opened placeholder can't be PUT back as empty — see computeTabSaveDiff.
  loadedTabIdsRef: MutableRefObject<Set<string>>;
  // Peer ops that arrive while a save is in flight, so the save's success
  // doesn't roll the baseline back to before them (docs/specs/012-collaboration/collab-race-hardening.md, save-baseline.ts).
  remoteOpJournalRef: MutableRefObject<RemoteOpJournal>;
  // The element writes this editor's saves have not had sequenced yet (own-element-writes.ts).
  ownWrites?: OwnElementWrites;
  // How many peer ops this render's `tabs` include: state, bumped in the same batch that applies each op.
  opsApplied: number;
  // True while a hover-preview is on screen. Previews mutate `tabs` (so they
  // render live) but must never be persisted; the debounced save below skips
  // while this is set, and the click-commit clears it and saves normally.
  previewingRef: MutableRefObject<boolean>;
  roomRef: RefObject<ReturnType<typeof connectRoom> | null>;
  setSaveStatus: Dispatch<SetStateAction<SaveStatus>>;
  setSavedAt: Dispatch<SetStateAction<number | null>>;
  // A save refused because the design is in the Trash
  // (docs/specs/013-workspace/trash.md): writes stop, the editor shows why.
  onDesignTrashed: () => void;
  // The changeset revision each tab holds, committed with the `tabs` of this render
  // (useChangesetSeen): sent with each save so the api merges only what the save lacks.
  changesetSeen: ReadonlyMap<string, number>;
  // Told the revision each tab save wrote (useTabRevisions), for the selection reference.
  noteTabRevision?: (tabId: string, rev: number) => void;
  // A Participant (docs/specs/013-workspace/share-roles.md): its saves are element ops to the room, never a
  // tab PUT, a tab delete or the design's metadata.
  participant?: boolean;
}) {
  return useAutosaveCore<
    Tab,
    ReturnType<typeof prepareTabSave>,
    Room,
    RemoteOpJournal,
    OwnElementWrites,
    SaveStatus
  >(
    {
      ...opts,
      itemId: opts.designId,
      itemName: opts.designName,
      onItemTrashed: opts.onDesignTrashed,
    },
    DEPS,
  );
}
