import {
  useCallback,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type RefObject,
  type SetStateAction,
} from 'react';
import type { Tab } from '@liveplanner/project';
import {
  apiDeleteTab,
  apiSaveProjectMeta,
  apiSaveTab,
  connectRoom,
  reportSaveFailure,
} from '@/lib/api-client';
import type { SaveStatus } from '@/components/chrome/EditorHeader';
import { saveFailureStatus } from './save-failure';
import { isProjectDeleted } from '@/lib/project-tombstones';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';
import { isProjectTrashedError } from '@/lib/project-trashed';
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
import { createTabSaveQueue, type TabSaveQueue } from './tab-save-queue';
import { useUnloadFlush } from './useUnloadFlush';
import { sampleSaveTiming, startEditorTiming } from '@/lib/timing';
import { noteSaveFailing, noteTabTooLarge } from '@liveworkspace/workbench/lib/save-health';
import { noteTabSaved } from '@liveworkspace/workbench/lib/tab-saved';

// Per-tab autosave (docs/specs/006-project/per-tab-storage.md), lifted out of editor-page.tsx. Two effects:
// a debounced (600ms) save and a beforeunload flush so a fast edit ->
// reload doesn't lose changes. Both diff via the tested computeTabSaveDiff
// kernel. The last-saved mirror refs live in the page (the hydration
// effect seeds them) and are passed in, as are the realtime room ref and
// the status/list setters.
export function useAutosave(opts: {
  hydrated: boolean;
  projectId: string | null;
  isReadOnly: boolean;
  tabs: Tab[];
  projectName: string;
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
  // A save refused because the project is in the Trash
  // (docs/specs/013-workspace/trash.md): writes stop, the editor shows why.
  onProjectTrashed: () => void;
  // The changeset revision each tab holds, committed with the `tabs` of this render
  // (useChangesetSeen): sent with each save so the api merges only what the save lacks.
  changesetSeen: ReadonlyMap<string, number>;
  // Told the revision each tab save wrote (useTabRevisions), for the selection reference.
  noteTabRevision?: (tabId: string, rev: number) => void;
  // A Participant (docs/specs/013-workspace/share-roles.md): its saves are element ops to the room, never a
  // tab PUT, a tab delete or the project's metadata.
  participant?: boolean;
}) {
  const {
    hydrated,
    projectId,
    isReadOnly,
    tabs,
    projectName,
    selfId,
    sessionShareCode,
    lastSavedTabsRef,
    lastSavedNameRef,
    loadedTabIdsRef,
    remoteOpJournalRef,
    ownWrites,
    opsApplied,
    previewingRef,
    roomRef,
    setSaveStatus,
    setSavedAt,
    onProjectTrashed,
    changesetSeen,
    noteTabRevision,
    participant = false,
  } = opts;

  // The caller passes a fresh function each render; read it when a save is refused (an effect event), so
  // it never re-arms the debounced save.
  const reportTrashed = useEffectEvent(() => onProjectTrashed());
  // Read when a save answers, never a trigger of the debounced save.
  const noteRevision = useEffectEvent((tabId: string, rev: number) =>
    noteTabRevision?.(tabId, rev),
  );

  // Set once the server has told us we may not write to this project at all
  // (403). Unlike a network failure that's worth another go on the next edit,
  // this can never succeed: the share link was revoked, we were removed from
  // the team, or the role changed under us. Retrying anyway meant a user could
  // edit for an hour against a project that would never take the writes,
  // seeing only a toast blaming their connection — and each edit fired another
  // doomed PUT, which is what produced hundreds of 403s in a single day.
  const writesForbiddenRef = useRef(false);

  // What `hasUnsavedChanges` reads when called (docs/specs/016-platform/new-version-prompt.md): the
  // inputs as of the last commit, and how many saves are still on the wire.
  const savesInFlightRef = useRef(0);
  const currentRef = useRef({ hydrated, projectId, isReadOnly, tabs, projectName });
  useEffect(() => {
    currentRef.current = { hydrated, projectId, isReadOnly, tabs, projectName };
  }, [hydrated, projectId, isReadOnly, tabs, projectName]);
  const hasUnsavedChanges = useCallback((): boolean => {
    const now = currentRef.current;
    if (!now.hydrated || !now.projectId || now.isReadOnly) return false;
    if (savesInFlightRef.current > 0) return true;
    return computeTabSaveDiff(
      lastSavedTabsRef.current,
      now.tabs,
      lastSavedNameRef.current,
      now.projectName,
      loadedTabIdsRef.current,
    ).hasChanges;
  }, [lastSavedTabsRef, lastSavedNameRef, loadedTabIdsRef]);

  // Saves can overlap (a PUT slower than the debounce). Only the NEWEST one to
  // land may move the baseline, or a slow older save would roll it back.
  const saveGenRef = useRef(0);
  const baselineGenRef = useRef(0);

  // A transient failure (network, 5xx) is retried on its own, not only on the next edit: during an
  // outage or a deploy the last edit would otherwise wait for another one that may never come
  // (docs/specs/006-project/per-tab-storage.md, "Retrying a failed save"). The tick re-runs the save
  // effect, which re-sends whatever still differs from the last saved state.
  const [retryTick, setRetryTick] = useState(0);
  const retryAttemptsRef = useRef(0);
  // Tabs to write again, content only: a peer changed them while (or just after) our save wrote them, so what D1
  // kept may be our older copy (docs/specs/012-collaboration/collab-race-hardening.md "A save that wrote over a
  // peer's change writes again"). The tick re-runs the save effect for them.
  const resaveTabIdsRef = useRef(new Set<string>());
  const [resaveTick, setResaveTick] = useState(0);
  const resaveTimersRef = useRef(new Set<number>());
  useEffect(() => {
    const timers = resaveTimersRef.current;
    return () => {
      for (const timer of timers) window.clearTimeout(timer);
    };
  }, []);
  const retryTimerRef = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (retryTimerRef.current !== null) window.clearTimeout(retryTimerRef.current);
    },
    [],
  );
  // Back online, a save waiting on its retry timer goes at once rather than up to a minute later
  // (docs/specs/007-editor/load-recovery.md "Offline").
  useEffect(() => {
    const onOnline = () => {
      if (retryTimerRef.current === null) return;
      window.clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
      setRetryTick((t) => t + 1);
    };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, []);

  // How many peer ops the `tabs` of THIS render already include. A peer's op
  // reaches the baseline at once but the screen only at the next render, so a
  // timer firing in between would diff a pre-op screen against a post-op
  // baseline and broadcast the peer's element back in its older form. The
  // timer below stands down when more ops have arrived than this render has;
  // applying one always re-renders, and this value in the deps re-arms it. It is state (opsApplied, bumped
  // in the batch that applies each op), so render reads no ref.
  const opsInRender = opsApplied;

  // A different project gets a clean slate: the block is about THIS one.
  useEffect(() => {
    writesForbiddenRef.current = false;
    noteSaveFailing(false);
    noteTabTooLarge(false);
    return () => {
      noteSaveFailing(false);
      noteTabTooLarge(false);
    };
  }, [projectId]);

  // The last edits on the way out: a page closed, hidden for good, or left for another page of the app
  // (useUnloadFlush).
  useUnloadFlush({
    hydrated,
    projectId,
    isReadOnly,
    participant,
    tabs,
    projectName,
    selfId,
    sessionShareCode,
    lastSavedTabsRef,
    lastSavedNameRef,
    loadedTabIdsRef,
    changesetSeen,
    writesForbiddenRef,
    roomRef,
  });

  // A page going to the background saves at once rather than after the debounce: a phone may discard it
  // there without another event (docs/specs/006-project/per-tab-storage.md "Saving").
  const [hiddenTick, setHiddenTick] = useState(0);
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') setHiddenTick((t) => t + 1);
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  // Each tab's writes in order (tab-save-queue.ts).
  const saveQueueRef = useRef<TabSaveQueue | null>(null);
  saveQueueRef.current ??= createTabSaveQueue();

  useEffect(() => {
    if (!hydrated || !projectId) return;
    if (isReadOnly) return;
    // The server has already refused a write to this project. Every further
    // attempt would fail the same way, so stop: the point is that the user is
    // told once, clearly, instead of being told to check their connection
    // every few seconds while their work goes nowhere.
    if (writesForbiddenRef.current) return;
    // A hover-preview is showing: its tick mutated `tabs`, but it's ephemeral
    // and will revert (or be replaced by a real commit), so don't persist it.
    // The commit/revert flips this ref off and re-runs the effect, which then
    // saves the committed state (or finds nothing changed after a revert).
    if (previewingRef.current) return;
    // No "was that a remote update?" skip here any more (docs/specs/012-collaboration/collab-race-hardening.md). A peer's
    // op is folded into the baseline as well as the screen, so it simply
    // isn't a difference. The skip it replaced cancelled any local save still
    // waiting out its debounce when a peer's op arrived.
    const handle = window.setTimeout(() => {
      if (remoteOpJournalRef.current.next !== opsInRender) return;
      // Bail if the project was just deleted (the debounce can still be
      // pending when the delete fires) so we don't re-create it.
      if (isProjectDeleted(projectId)) return;
      const { changedTabs, deletedIds, orderChanged, nameChanged, hasChanges } = computeTabSaveDiff(
        lastSavedTabsRef.current,
        tabs,
        lastSavedNameRef.current,
        projectName,
        loadedTabIdsRef.current,
      );
      // The tabs to write again: the same content as the baseline, so they send no ops, only the PUT.
      const changedIds = new Set(changedTabs.map((t) => t.id));
      const resaveTabs = participant
        ? []
        : tabs.filter(
            (t) =>
              resaveTabIdsRef.current.has(t.id) &&
              !changedIds.has(t.id) &&
              loadedTabIdsRef.current.has(t.id),
          );
      resaveTabIdsRef.current.clear();
      if (!hasChanges && resaveTabs.length === 0) {
        // Same content, different objects (a peer's op applied to both
        // sides): adopt ours so the next diff is an identity check again.
        lastSavedTabsRef.current = tabs;
        return;
      }
      if (resaveTabs.length > 0) {
        debugLog('[autosave] writing again over a peer change', { tabs: resaveTabs.length });
      }

      setSaveStatus('saving');
      savesInFlightRef.current++;
      // How long the save took, Saving to Saved (docs/specs/017-telemetry/timing-telemetry.md), sampled
      // to one per page per minute. A failed save records nothing; the Error category counts it.
      const timing = startEditorTiming('Save');
      const journal = remoteOpJournalRef.current;
      const mark = openSaveWindow(journal);
      let windowHeld = false;
      const savedTabIds = new Set([...changedTabs, ...resaveTabs].map((t) => t.id));
      const gen = ++saveGenRef.current;
      // What this client had seen of the room at the snapshot (docs/specs/012-collaboration/collab-race-hardening.md phase
      // 3): the api merges in only the answers and ticks it hadn't.
      const roomCursor = roomRef.current?.cursor() ?? null;
      const writes: Promise<unknown>[] = [];
      // The saves of tabs the last save did not have: the tab order waits for them (below).
      const newTabWrites: Promise<unknown>[] = [];
      const savedIds = new Set(lastSavedTabsRef.current.map((t) => t.id));
      for (const t of [...changedTabs, ...resaveTabs]) {
        // Granular ops (docs/specs/012-collaboration/realtime-conflict-resolution.md, Level 0), derived from the last state
        // peers saw, so concurrent different-element edits merge instead of the whole tab clobbering.
        const before = lastSavedTabsRef.current.find((s) => s.id === t.id);
        if (participant) {
          writes.push(relayParticipantChanges(before, t, () => roomRef.current, ownWrites));
          continue;
        }
        // Derived and held now, at the snapshot, though the queue may run the save later.
        const prepared = prepareTabSave(before, t, ownWrites);
        const write = saveQueueRef
          .current!.run(t.id, () =>
            saveTabAndRelay(
              before,
              t,
              () => roomRef.current,
              () =>
                apiSaveTab(selfId, projectId, t, sessionShareCode, {
                  // A loaded tab's content is authoritative, so an empty body is
                  // an intentional clear (reset-canvas / delete-all) the server
                  // backstop should accept; an unloaded placeholder is never in
                  // the set, so it can't authorise its own wipe (docs/specs/006-project/per-tab-storage.md).
                  allowEmpty: loadedTabIdsRef.current.has(t.id),
                  roomCursor,
                  // From the same render as `t`, never ahead of it (useChangesetSeen).
                  ...(changesetSeen.has(t.id) ? { changesetSeen: changesetSeen.get(t.id) } : {}),
                }),
              prepared,
            ),
          )
          .then((rev) => {
            if (rev !== null) noteRevision(t.id, rev);
            // A sheet made on this tab may be waiting for it to exist on the server (@liveworkspace/workbench/lib/tab-saved.ts).
            noteTabSaved(projectId, t.id);
          });
        writes.push(write);
        if (!savedIds.has(t.id)) newTabWrites.push(write);
      }
      // A Participant never deletes a tab or changes the project's metadata.
      for (const tabId of participant ? [] : deletedIds) {
        writes.push(
          saveQueueRef.current!.run(tabId, () =>
            apiDeleteTab(selfId, projectId, tabId, sessionShareCode),
          ),
        );
      }
      if (!participant && (orderChanged || nameChanged)) {
        // The order only places tab rows that exist (docs/specs/006-project/per-tab-storage.md "New tabs and the
        // tab order"): written beside the saves that create them, as a template's several tabs are, it could land
        // first, and the new tabs then sat at the end in id order. Settled, not succeeded: a failed new tab is
        // retried with the next save, which writes the order again.
        writes.push(
          Promise.allSettled(newTabWrites)
            .then(() =>
              apiSaveProjectMeta(
                selfId,
                {
                  id: projectId,
                  name: projectName,
                  tabs: tabs.map((t) => ({ id: t.id, folder: t.folder })),
                },
                sessionShareCode,
              ),
            )
            .then(() => {
              roomRef.current?.send({
                kind: 'op',
                op: {
                  kind: 'project-meta',
                  name: projectName,
                  tabs: tabs.map((t, i) => ({
                    id: t.id,
                    name: t.name,
                    orderIndex: i,
                    folder: t.folder,
                  })),
                },
              });
            }),
        );
      }
      Promise.all(writes)
        .then(() => {
          // The snapshot is saved; peers' ops that arrived since go back on
          // top of it (docs/specs/012-collaboration/collab-race-hardening.md). An older save landing after a newer one
          // leaves the baseline alone.
          if (gen > baselineGenRef.current) {
            baselineGenRef.current = gen;
            const next = baselineAfterSave(journal, mark, tabs, projectName);
            lastSavedTabsRef.current = next.tabs;
            lastSavedNameRef.current = next.name;
          }
          // Peers' element changes to what we just wrote, from the snapshot to a moment after the write: ours may
          // have landed over theirs in D1, so those tabs are written again with what is on screen.
          windowHeld = true;
          const timer = window.setTimeout(() => {
            resaveTimersRef.current.delete(timer);
            const touched = participant ? [] : tabsChangedByPeersSince(journal, mark, savedTabIds);
            closeSaveWindow(journal);
            if (touched.length === 0) return;
            for (const id of touched) resaveTabIdsRef.current.add(id);
            setResaveTick((t) => t + 1);
          }, SAVE_RESAVE_GRACE_MS);
          resaveTimersRef.current.add(timer);
          setSaveStatus('saved');
          noteSaveFailing(false);
          noteTabTooLarge(false);
          if (sampleSaveTiming()) timing.end();
          else timing.cancel();
          retryAttemptsRef.current = 0;
          const now = Date.now();
          setSavedAt(now);
        })
        .catch((err: unknown) => {
          timing.cancel();
          // What was to be written again still is.
          for (const t of resaveTabs) resaveTabIdsRef.current.add(t.id);
          if (isProjectTrashedError(err)) {
            writesForbiddenRef.current = true;
            reportTrashed();
            return;
          }
          reportSaveFailure(err);
          const status = saveFailureStatus(err);
          if (status === 'forbidden') writesForbiddenRef.current = true;
          setSaveStatus(status);
          // A failure the retry may fix keeps the banner up and the leave prompt armed (@liveworkspace/workbench/lib/save-health.ts).
          noteSaveFailing(status === 'error');
          noteTabTooLarge(status === 'tooLarge');
          if (status === 'error' && retryTimerRef.current === null) {
            const delay = saveRetryDelayMs(retryAttemptsRef.current++);
            retryTimerRef.current = window.setTimeout(() => {
              retryTimerRef.current = null;
              setRetryTick((t) => t + 1);
            }, delay);
          }
        })
        .finally(() => {
          savesInFlightRef.current--;
          // A save that landed keeps its window open a little longer (above).
          if (!windowHeld) closeSaveWindow(journal);
        });
    }, saveDelayMs());
    return () => window.clearTimeout(handle);
  }, [
    hydrated,
    projectId,
    tabs,
    projectName,
    selfId,
    isReadOnly,
    participant,
    sessionShareCode,
    opsInRender,
    retryTick,
    resaveTick,
    hiddenTick,
    changesetSeen,
    lastSavedTabsRef,
    lastSavedNameRef,
    loadedTabIdsRef,
    previewingRef,
    remoteOpJournalRef,
    ownWrites,
    roomRef,
    setSaveStatus,
    setSavedAt,
  ]);

  return { hasUnsavedChanges };
}

// The autosave's debounce: none while the page is in the background, where it may not live to the next.
const SAVE_DEBOUNCE_MS = 600;
const saveDelayMs = () =>
  typeof document !== 'undefined' && document.visibilityState === 'hidden' ? 0 : SAVE_DEBOUNCE_MS;

// 5s, 10s, 20s, 40s, then a minute between attempts.
function saveRetryDelayMs(attempt: number): number {
  return Math.min(60_000, 5_000 * 2 ** attempt);
}
