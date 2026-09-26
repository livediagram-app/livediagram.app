import {
  useEffect,
  useRef,
  type Dispatch,
  type MutableRefObject,
  type RefObject,
  type SetStateAction,
} from 'react';
import type { Tab } from '@livediagram/diagram';
import {
  ApiError,
  apiDeleteTab,
  apiSaveDiagramMeta,
  apiSaveTab,
  connectRoom,
  flushDiagramSavesBeacon,
  type DiagramListItem,
} from '@/lib/api-client';
import type { SaveStatus } from '@/components/chrome/EditorHeader';
import { isDiagramDeleted } from '@/lib/diagram-tombstones';
import { computeTabSaveDiff } from './editor-page-helpers';
import { tabBroadcastOps } from './tab-broadcast-ops';
import {
  baselineAfterSave,
  closeSaveWindow,
  openSaveWindow,
  type RemoteOpJournal,
} from './save-baseline';

// Per-tab autosave (spec/13), lifted out of editor-page.tsx. Two effects:
// a debounced (600ms) save and a beforeunload flush so a fast edit ->
// reload doesn't lose changes. Both diff via the tested computeTabSaveDiff
// kernel. The last-saved mirror refs live in the page (the hydration
// effect seeds them) and are passed in, as are the realtime room ref and
// the status/list setters.
export function useAutosave(opts: {
  hydrated: boolean;
  diagramId: string | null;
  isReadOnly: boolean;
  tabs: Tab[];
  diagramName: string;
  selfId: string;
  sessionShareCode: string | null;
  lastSavedTabsRef: MutableRefObject<Tab[]>;
  lastSavedNameRef: MutableRefObject<string>;
  // The set of tabs whose content is authoritative in memory (hydrated /
  // fetched / locally-created). Gates the content-write diff so a never-
  // opened placeholder can't be PUT back as empty — see computeTabSaveDiff.
  loadedTabIdsRef: MutableRefObject<Set<string>>;
  // Peer ops that arrive while a save is in flight, so the save's success
  // doesn't roll the baseline back to before them (spec/152, save-baseline.ts).
  remoteOpJournalRef: MutableRefObject<RemoteOpJournal>;
  // True while a hover-preview is on screen. Previews mutate `tabs` (so they
  // render live) but must never be persisted; the debounced save below skips
  // while this is set, and the click-commit clears it and saves normally.
  previewingRef: MutableRefObject<boolean>;
  roomRef: RefObject<ReturnType<typeof connectRoom> | null>;
  setSaveStatus: Dispatch<SetStateAction<SaveStatus>>;
  setSavedAt: Dispatch<SetStateAction<number | null>>;
  setDiagramList: Dispatch<SetStateAction<DiagramListItem[]>>;
}) {
  const {
    hydrated,
    diagramId,
    isReadOnly,
    tabs,
    diagramName,
    selfId,
    sessionShareCode,
    lastSavedTabsRef,
    lastSavedNameRef,
    loadedTabIdsRef,
    remoteOpJournalRef,
    previewingRef,
    roomRef,
    setSaveStatus,
    setSavedAt,
    setDiagramList,
  } = opts;

  // Set once the server has told us we may not write to this diagram at all
  // (403). Unlike a network failure that's worth another go on the next edit,
  // this can never succeed: the share link was revoked, we were removed from
  // the team, or the role changed under us. Retrying anyway meant a user could
  // edit for an hour against a diagram that would never take the writes,
  // seeing only a toast blaming their connection — and each edit fired another
  // doomed PUT, which is what produced hundreds of 403s in a single day.
  const writesForbiddenRef = useRef(false);

  // Saves can overlap (a PUT slower than the debounce). Only the NEWEST one to
  // land may move the baseline, or a slow older save would roll it back.
  const saveGenRef = useRef(0);
  const baselineGenRef = useRef(0);

  // How many peer ops the `tabs` of THIS render already include. A peer's op
  // reaches the baseline at once but the screen only at the next render, so a
  // timer firing in between would diff a pre-op screen against a post-op
  // baseline and broadcast the peer's element back in its older form. The
  // timer below stands down when more ops have arrived than this render has;
  // applying one always re-renders, and this value in the deps re-arms it.
  const opsInRender = remoteOpJournalRef.current.next;

  // A different diagram gets a clean slate: the block is about THIS one.
  useEffect(() => {
    writesForbiddenRef.current = false;
  }, [diagramId]);

  useEffect(() => {
    if (!hydrated || !diagramId || isReadOnly) return;
    const handler = () => {
      // Nothing we send can be accepted; don't beacon on the way out either.
      if (writesForbiddenRef.current) return;
      // The user just deleted this diagram (navigating to /explorer fires
      // beforeunload): don't beacon its tabs/meta back and re-create it.
      if (isDiagramDeleted(diagramId)) return;
      const { changedTabs, deletedIds, orderChanged, nameChanged, hasChanges } = computeTabSaveDiff(
        lastSavedTabsRef.current,
        tabs,
        lastSavedNameRef.current,
        diagramName,
        loadedTabIdsRef.current,
      );
      if (!hasChanges) return;
      // The raw keepalive writes live behind the api-client boundary now
      // (flushDiagramSavesBeacon) so this hook holds no fetch of its own.
      flushDiagramSavesBeacon({
        ownerId: selfId,
        diagramId,
        shareCode: sessionShareCode,
        changedTabs,
        deletedIds,
        loadedTabIds: loadedTabIdsRef.current,
        orderChanged,
        nameChanged,
        name: diagramName,
        tabs,
      });
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
    // Omitted deps are all refs + state setters (stable by React's guarantee).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, diagramId, isReadOnly, tabs, diagramName, selfId, sessionShareCode]);

  useEffect(() => {
    if (!hydrated || !diagramId) return;
    if (isReadOnly) return;
    // The server has already refused a write to this diagram. Every further
    // attempt would fail the same way, so stop: the point is that the user is
    // told once, clearly, instead of being told to check their connection
    // every few seconds while their work goes nowhere.
    if (writesForbiddenRef.current) return;
    // A hover-preview is showing: its tick mutated `tabs`, but it's ephemeral
    // and will revert (or be replaced by a real commit), so don't persist it.
    // The commit/revert flips this ref off and re-runs the effect, which then
    // saves the committed state (or finds nothing changed after a revert).
    if (previewingRef.current) return;
    // No "was that a remote update?" skip here any more (spec/152). A peer's
    // op is folded into the baseline as well as the screen, so it simply
    // isn't a difference. The skip it replaced cancelled any local save still
    // waiting out its debounce when a peer's op arrived.
    const handle = window.setTimeout(() => {
      if (remoteOpJournalRef.current.next !== opsInRender) return;
      // Bail if the diagram was just deleted (the debounce can still be
      // pending when the delete fires) so we don't re-create it.
      if (isDiagramDeleted(diagramId)) return;
      const { changedTabs, deletedIds, orderChanged, nameChanged, hasChanges } = computeTabSaveDiff(
        lastSavedTabsRef.current,
        tabs,
        lastSavedNameRef.current,
        diagramName,
        loadedTabIdsRef.current,
      );
      if (!hasChanges) {
        // Same content, different objects (a peer's op applied to both
        // sides): adopt ours so the next diff is an identity check again.
        lastSavedTabsRef.current = tabs;
        return;
      }

      setSaveStatus('saving');
      const journal = remoteOpJournalRef.current;
      const mark = openSaveWindow(journal);
      const gen = ++saveGenRef.current;
      // What this client had seen of the room at the snapshot (spec/152 phase
      // 3): the api merges in only the answers and ticks it hadn't.
      const roomCursor = roomRef.current?.cursor() ?? null;
      const writes: Promise<unknown>[] = [];
      for (const t of changedTabs) {
        // The ops are derived NOW, against what peers have at the snapshot,
        // not when the PUT lands: by then the baseline may hold a peer's
        // newer copy of an element, and diffing our snapshot against it would
        // broadcast our older copy over theirs.
        const before = lastSavedTabsRef.current.find((s) => s.id === t.id);
        const ops = tabBroadcastOps(before, t);
        writes.push(
          apiSaveTab(selfId, diagramId, t, sessionShareCode, {
            // A loaded tab's content is authoritative, so an empty body is
            // an intentional clear (reset-canvas / delete-all) the server
            // backstop should accept; an unloaded placeholder is never in
            // the set, so it can't authorise its own wipe (spec/13).
            allowEmpty: loadedTabIdsRef.current.has(t.id),
            roomCursor,
          }).then(() => {
            // Broadcast granular element ops (spec/75, Level 0) derived from
            // the last state peers saw so concurrent different-element edits
            // merge instead of the whole tab clobbering. Falls back to a
            // whole-`tab` op for a new tab or a bulk change (tabBroadcastOps).
            for (const op of ops) {
              roomRef.current?.send({ kind: 'op', op });
            }
          }),
        );
      }
      for (const tabId of deletedIds) {
        writes.push(apiDeleteTab(selfId, diagramId, tabId, sessionShareCode));
      }
      if (orderChanged || nameChanged) {
        writes.push(
          apiSaveDiagramMeta(
            selfId,
            {
              id: diagramId,
              name: diagramName,
              tabs: tabs.map((t) => ({ id: t.id, folder: t.folder })),
            },
            sessionShareCode,
          ).then(() => {
            roomRef.current?.send({
              kind: 'op',
              op: {
                kind: 'diagram-meta',
                name: diagramName,
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
          // top of it (spec/152). An older save landing after a newer one
          // leaves the baseline alone.
          if (gen > baselineGenRef.current) {
            baselineGenRef.current = gen;
            const next = baselineAfterSave(journal, mark, tabs, diagramName);
            lastSavedTabsRef.current = next.tabs;
            lastSavedNameRef.current = next.name;
          }
          setSaveStatus('saved');
          const now = Date.now();
          setSavedAt(now);
          // Bump the current diagram's row locally so the Explorer's
          // "Updated X ago" stays fresh — used to refetch the whole
          // list here, which hit /api/diagrams on every autosave.
          setDiagramList((prev) =>
            prev.map((d) => (d.id === diagramId ? { ...d, savedAt: now, name: diagramName } : d)),
          );
        })
        .catch((err: unknown) => {
          if (err instanceof ApiError && err.status === 403) {
            writesForbiddenRef.current = true;
            setSaveStatus('forbidden');
            return;
          }
          setSaveStatus('error');
        })
        .finally(() => closeSaveWindow(journal));
    }, 600);
    return () => window.clearTimeout(handle);
    // Omitted deps are all refs + state setters (stable by React's guarantee).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, diagramId, tabs, diagramName, selfId, isReadOnly, sessionShareCode, opsInRender]);
}
