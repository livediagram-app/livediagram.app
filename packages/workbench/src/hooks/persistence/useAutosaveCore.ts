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
import { debugLog } from '../../lib/debug-log';
import { noteSaveFailing, noteTabTooLarge } from '../../lib/save-health';

// Per-tab autosave (each product's docs/specs/006-*/per-tab-storage.md). Two effects: a debounced (600ms) save and
// the unload flush (the product's useUnloadFlush), so a fast edit then reload doesn't lose changes. Both diff via
// the product's tested computeTabSaveDiff kernel. The last-saved mirror refs live in the page (the hydration effect
// seeds them) and are passed in, as are the realtime room ref and the status/list setters. Every editor's
// app/<item>/[id]/useAutosave.ts calls this with its own calls and the few places its copy had drifted
// (AutosaveDeps), under its own names for the item.

type TabBase = { id: string; name: string; folder?: string };

type SaveDiff<Tab> = {
  changedTabs: Tab[];
  deletedIds: string[];
  orderChanged: boolean;
  nameChanged: boolean;
  hasChanges: boolean;
};

type Timing = { end: () => void; cancel: () => void };

// An editor's room takes its own op type; the meta op below is one of them.
type Room = {
  cursor: () => { epoch: string; seq: number } | null;
  send: (msg: never) => void;
};

// The journal of peer ops (each product's save-baseline.ts): `next` counts the ops applied so far.
type Journal = { next: number };

export type AutosaveUnloadArgs<Tab, R> = {
  hydrated: boolean;
  itemId: string | null;
  isReadOnly: boolean;
  participant: boolean;
  tabs: Tab[];
  itemName: string;
  selfId: string;
  sessionShareCode: string | null;
  lastSavedTabsRef: MutableRefObject<Tab[]>;
  lastSavedNameRef: MutableRefObject<string>;
  loadedTabIdsRef: MutableRefObject<Set<string>>;
  changesetSeen: ReadonlyMap<string, number>;
  writesForbiddenRef: MutableRefObject<boolean>;
  roomRef: RefObject<R | null>;
};

export type AutosaveDeps<Tab, Prepared, R, J extends Journal, Writes, S> = {
  apiSaveTab: (
    selfId: string,
    itemId: string,
    tab: Tab,
    shareCode: string | null,
    opts: {
      allowEmpty: boolean;
      roomCursor: { epoch: string; seq: number } | null;
      saveChanges?: string | null;
      changesetSeen?: number;
    },
  ) => Promise<number | null>;
  apiDeleteTab: (
    selfId: string,
    itemId: string,
    tabId: string,
    shareCode: string | null,
  ) => Promise<void>;
  apiSaveMeta: (
    selfId: string,
    meta: { id: string; name: string; tabs: { id: string; folder?: string }[] },
    shareCode: string | null,
  ) => Promise<unknown>;
  // The op an editor's own rename sends: `document-meta`, `design-meta`, `project-meta`.
  metaKind: string;
  reportSaveFailure: (err: unknown) => void;
  saveFailureStatus: (err: unknown) => S;
  isItemDeleted: (id: string) => boolean;
  isItemTrashedError: (err: unknown) => boolean;
  computeTabSaveDiff: (
    saved: Tab[],
    tabs: Tab[],
    savedName: string,
    name: string,
    loaded: Set<string>,
  ) => SaveDiff<Tab>;
  prepareTabSave: (
    before: Tab | undefined,
    tab: Tab,
    writes?: Writes,
    previous?: Tab,
  ) => Prepared & { changes?: string | null };
  relayParticipantChanges: (
    before: Tab | undefined,
    tab: Tab,
    room: () => R | null,
    writes?: Writes,
    claim?: (ids: string[]) => Promise<void>,
  ) => Promise<unknown>;
  saveTabAndRelay: (
    before: Tab | undefined,
    tab: Tab,
    room: () => R | null,
    put: () => Promise<number | null>,
    prepared: Prepared,
  ) => Promise<number | null>;
  baseline: {
    open: (journal: J) => number;
    close: (journal: J) => void;
    after: (journal: J, mark: number, tabs: Tab[], name: string) => { tabs: Tab[]; name: string };
    changedByPeersSince: (journal: J, mark: number, ids: Set<string>) => string[];
    graceMs: number;
  };
  createTabSaveQueue: () => {
    run: <T>(tabId: string, op: () => Promise<T>) => Promise<T>;
  };
  useUnloadFlush: (args: AutosaveUnloadArgs<Tab, R>) => void;
  startEditorTiming: (name: 'Save') => Timing;
  sampleSaveTiming: () => boolean;
  // Drifts, each one product's own:
  // A Participant claims the pictures it places first (docs/specs/009-elements/images.md "Placement grants").
  claimPlacedImages?: (
    selfId: string,
    itemId: string,
    ids: string[],
    shareCode: string | null,
  ) => Promise<void>;
  // Each tab's save is prepared against its last one too, which may still be in flight, and sends its changes.
  trackPrevious?: boolean;
  // Something a tab's PUT waits on first (a photo's pixels), or null.
  beforeTabPut?: (tabId: string) => Promise<unknown> | null;
  // A save's revision is told to the caller (noteTabRevision).
  notesRevisions?: boolean;
  // Told once a tab's save landed (a sheet waiting on the tab to exist on the server).
  noteTabSaved?: (itemId: string, tabId: string) => void;
};

export type AutosaveOptions<Tab, R, J, Writes, S> = {
  hydrated: boolean;
  itemId: string | null;
  isReadOnly: boolean;
  tabs: Tab[];
  itemName: string;
  selfId: string;
  sessionShareCode: string | null;
  lastSavedTabsRef: MutableRefObject<Tab[]>;
  lastSavedNameRef: MutableRefObject<string>;
  // The set of tabs whose content is authoritative in memory. Gates the content-write diff so a never-opened
  // placeholder can't be PUT back as empty.
  loadedTabIdsRef: MutableRefObject<Set<string>>;
  // Peer ops that arrive while a save is in flight, so the save's success doesn't roll the baseline back.
  remoteOpJournalRef: MutableRefObject<J>;
  // The element writes this editor's saves have not had sequenced yet.
  ownWrites?: Writes;
  // How many peer ops this render's `tabs` include: state, bumped in the same batch that applies each op.
  opsApplied: number;
  // True while a hover-preview is on screen: previews mutate `tabs` but are never persisted.
  previewingRef: MutableRefObject<boolean>;
  roomRef: RefObject<R | null>;
  // `S` is the editor's whole status type: 'saving', 'saved' and every failure saveFailureStatus answers.
  setSaveStatus: Dispatch<SetStateAction<S>>;
  setSavedAt: Dispatch<SetStateAction<number | null>>;
  // A save refused because the item is in the Trash: writes stop, the editor shows why.
  onItemTrashed: () => void;
  // The changeset revision each tab holds, committed with the `tabs` of this render.
  changesetSeen: ReadonlyMap<string, number>;
  noteTabRevision?: (tabId: string, rev: number) => void;
  // A Participant's saves are element ops to the room, never a tab PUT, a tab delete or the item's metadata.
  participant?: boolean;
};

export function useAutosaveCore<
  Tab extends TabBase,
  Prepared,
  R extends Room,
  J extends Journal,
  Writes,
  S extends string,
>(opts: AutosaveOptions<Tab, R, J, Writes, S>, deps: AutosaveDeps<Tab, Prepared, R, J, Writes, S>) {
  const {
    hydrated,
    itemId,
    isReadOnly,
    tabs,
    itemName,
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
    onItemTrashed,
    changesetSeen,
    noteTabRevision,
    participant = false,
  } = opts;

  // The caller passes a fresh function each render; read it when a save is refused (an effect event), so it never
  // re-arms the debounced save.
  const reportTrashed = useEffectEvent(() => onItemTrashed());
  // Read when a save answers, never a trigger of the debounced save.
  const noteRevision = useEffectEvent((tabId: string, rev: number) =>
    noteTabRevision?.(tabId, rev),
  );

  // Set once the server has told us we may not write to this item at all (403). Unlike a network failure that's
  // worth another go on the next edit, this can never succeed: the share link was revoked, we were removed from the
  // team, or the role changed under us. Retrying anyway meant each edit fired another doomed PUT.
  const writesForbiddenRef = useRef(false);

  // What `hasUnsavedChanges` reads when called (docs/specs/016-platform/new-version-prompt.md): the inputs as of the
  // last commit, and how many saves are still on the wire.
  const savesInFlightRef = useRef(0);
  const currentRef = useRef({ hydrated, itemId, isReadOnly, tabs, itemName });
  useEffect(() => {
    currentRef.current = { hydrated, itemId, isReadOnly, tabs, itemName };
  }, [hydrated, itemId, isReadOnly, tabs, itemName]);
  const { computeTabSaveDiff } = deps;
  const hasUnsavedChanges = useCallback((): boolean => {
    const now = currentRef.current;
    if (!now.hydrated || !now.itemId || now.isReadOnly) return false;
    if (savesInFlightRef.current > 0) return true;
    return computeTabSaveDiff(
      lastSavedTabsRef.current,
      now.tabs,
      lastSavedNameRef.current,
      now.itemName,
      loadedTabIdsRef.current,
    ).hasChanges;
  }, [lastSavedTabsRef, lastSavedNameRef, loadedTabIdsRef, computeTabSaveDiff]);

  // Saves can overlap (a PUT slower than the debounce). Only the NEWEST one to land may move the baseline, or a
  // slow older save would roll it back.
  const saveGenRef = useRef(0);
  const baselineGenRef = useRef(0);

  // A transient failure (network, 5xx) is retried on its own, not only on the next edit ("Retrying a failed
  // save"). The tick re-runs the save effect, which re-sends whatever still differs from the last saved state.
  const [retryTick, setRetryTick] = useState(0);
  const retryAttemptsRef = useRef(0);
  // Tabs to write again, content only: a peer changed them while (or just after) our save wrote them, so what the
  // canvas kept may be our older copy (collab-race-hardening.md "A save that wrote over a peer's change writes
  // again"). The tick re-runs the save effect for them.
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

  // How many peer ops the `tabs` of THIS render already include. A peer's op reaches the baseline at once but the
  // screen only at the next render, so a timer firing in between would diff a pre-op screen against a post-op
  // baseline and broadcast the peer's element back in its older form. The timer below stands down when more ops have
  // arrived than this render has; applying one always re-renders, and this value in the deps re-arms it.
  const opsInRender = opsApplied;

  // A different item gets a clean slate: the block is about THIS one.
  useEffect(() => {
    writesForbiddenRef.current = false;
    noteSaveFailing(false);
    noteTabTooLarge(false);
    return () => {
      noteSaveFailing(false);
      noteTabTooLarge(false);
    };
  }, [itemId]);

  // The last edits on the way out: a page closed, hidden for good, or left for another page of the app.
  deps.useUnloadFlush({
    hydrated,
    itemId,
    isReadOnly,
    participant,
    tabs,
    itemName,
    selfId,
    sessionShareCode,
    lastSavedTabsRef,
    lastSavedNameRef,
    loadedTabIdsRef,
    changesetSeen,
    writesForbiddenRef,
    roomRef,
  });

  // A page going to the background saves at once rather than after the debounce: a phone may discard it there
  // without another event ("Saving").
  const [hiddenTick, setHiddenTick] = useState(0);
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') setHiddenTick((t) => t + 1);
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  // Each tab's writes in order (tab-save-queue.ts).
  const saveQueueRef = useRef<ReturnType<typeof deps.createTabSaveQueue> | null>(null);
  saveQueueRef.current ??= deps.createTabSaveQueue();
  // Each tab as its last save took it, by id (`trackPrevious`): the next save's changes remove what it held and
  // this one lacks.
  const preparedTabsRef = useRef(new Map<string, Tab>());

  useEffect(() => {
    if (!hydrated || !itemId) return;
    if (isReadOnly) return;
    // The server has already refused a write to this item. Every further attempt would fail the same way, so stop:
    // the user is told once, clearly.
    if (writesForbiddenRef.current) return;
    // A hover-preview is showing: its tick mutated `tabs`, but it's ephemeral and will revert (or be replaced by a
    // real commit), so don't persist it. The commit/revert flips this ref off and re-runs the effect.
    if (previewingRef.current) return;
    // No "was that a remote update?" skip here: a peer's op is folded into the baseline as well as the screen, so
    // it simply isn't a difference.
    const handle = window.setTimeout(() => {
      if (remoteOpJournalRef.current.next !== opsInRender) return;
      // Bail if the item was just deleted (the debounce can still be pending when the delete fires) so we don't
      // re-create it.
      if (deps.isItemDeleted(itemId)) return;
      const { changedTabs, deletedIds, orderChanged, nameChanged, hasChanges } = computeTabSaveDiff(
        lastSavedTabsRef.current,
        tabs,
        lastSavedNameRef.current,
        itemName,
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
        // Same content, different objects (a peer's op applied to both sides): adopt ours so the next diff is an
        // identity check again.
        lastSavedTabsRef.current = tabs;
        return;
      }
      if (resaveTabs.length > 0) {
        debugLog('[autosave] writing again over a peer change', { tabs: resaveTabs.length });
      }

      setSaveStatus('saving' as S);
      savesInFlightRef.current++;
      // How long the save took, Saving to Saved (docs/specs/017-telemetry/timing-telemetry.md), sampled to one per
      // page per minute. A failed save records nothing; the Error category counts it.
      const timing = deps.startEditorTiming('Save');
      const journal = remoteOpJournalRef.current;
      const mark = deps.baseline.open(journal);
      let windowHeld = false;
      const savedTabIds = new Set([...changedTabs, ...resaveTabs].map((t) => t.id));
      const gen = ++saveGenRef.current;
      // What this client had seen of the room at the snapshot (collab-race-hardening.md phase 3): the api merges
      // in only the answers and ticks it hadn't.
      const roomCursor = roomRef.current?.cursor() ?? null;
      const writes: Promise<unknown>[] = [];
      // The saves of tabs the last save did not have: the tab order waits for them (below).
      const newTabWrites: Promise<unknown>[] = [];
      const savedIds = new Set(lastSavedTabsRef.current.map((t) => t.id));
      for (const t of [...changedTabs, ...resaveTabs]) {
        // Granular ops (realtime-conflict-resolution.md, Level 0), derived from the last state peers saw, so
        // concurrent different-element edits merge instead of the whole tab clobbering.
        const before = lastSavedTabsRef.current.find((s) => s.id === t.id);
        if (participant) {
          const claimPlacedImages = deps.claimPlacedImages;
          const claim = claimPlacedImages
            ? (ids: string[]) => claimPlacedImages(selfId, itemId, ids, sessionShareCode)
            : undefined;
          writes.push(
            claim
              ? deps.relayParticipantChanges(before, t, () => roomRef.current, ownWrites, claim)
              : deps.relayParticipantChanges(before, t, () => roomRef.current, ownWrites),
          );
          continue;
        }
        // Derived and held now, at the snapshot, though the queue may run the save later; with `trackPrevious`,
        // against this tab's last save as well, which may still be in flight.
        const prepared = deps.trackPrevious
          ? deps.prepareTabSave(before, t, ownWrites, preparedTabsRef.current.get(t.id))
          : deps.prepareTabSave(before, t, ownWrites);
        if (deps.trackPrevious) preparedTabsRef.current.set(t.id, t);
        const put = () =>
          deps.apiSaveTab(selfId, itemId, t, sessionShareCode, {
            // A loaded tab's content is authoritative, so an empty body is an intentional clear (reset-canvas /
            // delete-all) the server backstop should accept; an unloaded placeholder is never in the set, so it
            // can't authorise its own wipe.
            allowEmpty: loadedTabIdsRef.current.has(t.id),
            roomCursor,
            ...(deps.trackPrevious ? { saveChanges: prepared.changes } : {}),
            // From the same render as `t`, never ahead of it (useChangesetSeen).
            ...(changesetSeen.has(t.id) ? { changesetSeen: changesetSeen.get(t.id) } : {}),
          });
        const beforeTabPut = deps.beforeTabPut;
        const queued = saveQueueRef.current!.run(t.id, () =>
          deps.saveTabAndRelay(
            before,
            t,
            () => roomRef.current,
            beforeTabPut
              ? async () => {
                  const wait = beforeTabPut(t.id);
                  if (wait) await wait;
                  return put();
                }
              : put,
            prepared,
          ),
        );
        const write = deps.notesRevisions
          ? queued.then((rev) => {
              if (rev !== null) noteRevision(t.id, rev);
              deps.noteTabSaved?.(itemId, t.id);
            })
          : queued;
        writes.push(write);
        if (!savedIds.has(t.id)) newTabWrites.push(write);
      }
      // A Participant never deletes a tab or changes the item's metadata.
      for (const tabId of participant ? [] : deletedIds) {
        writes.push(
          saveQueueRef.current!.run(tabId, () =>
            deps.apiDeleteTab(selfId, itemId, tabId, sessionShareCode),
          ),
        );
      }
      if (!participant && (orderChanged || nameChanged)) {
        // The order only places tab rows that exist ("New tabs and the tab order"): written beside the saves that
        // create them, it could land first, and the new tabs then sat at the end in id order. Settled, not
        // succeeded: a failed new tab is retried with the next save, which writes the order again.
        writes.push(
          Promise.allSettled(newTabWrites)
            .then(() =>
              deps.apiSaveMeta(
                selfId,
                {
                  id: itemId,
                  name: itemName,
                  tabs: tabs.map((t) => ({ id: t.id, folder: t.folder })),
                },
                sessionShareCode,
              ),
            )
            .then(() => {
              roomRef.current?.send({
                kind: 'op',
                op: {
                  kind: deps.metaKind,
                  name: itemName,
                  tabs: tabs.map((t, i) => ({
                    id: t.id,
                    name: t.name,
                    orderIndex: i,
                    folder: t.folder,
                  })),
                },
              } as never);
            }),
        );
      }
      Promise.all(writes)
        .then(() => {
          // The snapshot is saved; peers' ops that arrived since go back on top of it. An older save landing after
          // a newer one leaves the baseline alone.
          if (gen > baselineGenRef.current) {
            baselineGenRef.current = gen;
            const next = deps.baseline.after(journal, mark, tabs, itemName);
            lastSavedTabsRef.current = next.tabs;
            lastSavedNameRef.current = next.name;
          }
          // Peers' element changes to what we just wrote, from the snapshot to a moment after the write: ours may
          // have landed over theirs in the stored tab, so those tabs are written again with what is on screen.
          windowHeld = true;
          const timer = window.setTimeout(() => {
            resaveTimersRef.current.delete(timer);
            const touched = participant
              ? []
              : deps.baseline.changedByPeersSince(journal, mark, savedTabIds);
            deps.baseline.close(journal);
            if (touched.length === 0) return;
            for (const id of touched) resaveTabIdsRef.current.add(id);
            setResaveTick((t) => t + 1);
          }, deps.baseline.graceMs);
          resaveTimersRef.current.add(timer);
          setSaveStatus('saved' as S);
          noteSaveFailing(false);
          noteTabTooLarge(false);
          if (deps.sampleSaveTiming()) timing.end();
          else timing.cancel();
          retryAttemptsRef.current = 0;
          const now = Date.now();
          setSavedAt(now);
        })
        .catch((err: unknown) => {
          timing.cancel();
          // What was to be written again still is.
          for (const t of resaveTabs) resaveTabIdsRef.current.add(t.id);
          if (deps.isItemTrashedError(err)) {
            writesForbiddenRef.current = true;
            reportTrashed();
            return;
          }
          deps.reportSaveFailure(err);
          const status = deps.saveFailureStatus(err);
          if (status === 'forbidden') writesForbiddenRef.current = true;
          setSaveStatus(status);
          // A failure the retry may fix keeps the banner up and the leave prompt armed (lib/save-health.ts).
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
          if (!windowHeld) deps.baseline.close(journal);
        });
    }, saveDelayMs());
    return () => window.clearTimeout(handle);
    // `deps` is the product's module constant: the same object every render, so it never re-arms the save.
  }, [
    hydrated,
    itemId,
    tabs,
    itemName,
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
    deps,
    computeTabSaveDiff,
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
