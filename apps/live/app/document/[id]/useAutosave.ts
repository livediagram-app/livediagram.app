import {
  useEffect,
  useEffectEvent,
  useRef,
  type Dispatch,
  type MutableRefObject,
  type RefObject,
  type SetStateAction,
} from 'react';
import type { Tab } from '@livediagram/document';
import {
  apiDeleteTab,
  apiSaveDocumentMeta,
  apiSaveTab,
  connectRoom,
  flushDocumentSavesBeacon,
  reportSaveFailure,
  type DocumentListItem,
} from '@/lib/api-client';
import type { SaveStatus } from '@/components/chrome/EditorHeader';
import { saveFailureStatus } from './save-failure';
import { isDocumentDeleted } from '@/lib/document-tombstones';
import { isDocumentTrashedError } from '@/lib/document-trashed';
import { computeTabSaveDiff } from './editor-page-helpers';
import { tabBroadcastOps } from './tab-broadcast-ops';
import {
  baselineAfterSave,
  closeSaveWindow,
  openSaveWindow,
  type RemoteOpJournal,
} from './save-baseline';

// Per-tab autosave (docs/specs/006-document/per-tab-storage.md), lifted out of editor-page.tsx. Two effects:
// a debounced (600ms) save and a beforeunload flush so a fast edit ->
// reload doesn't lose changes. Both diff via the tested computeTabSaveDiff
// kernel. The last-saved mirror refs live in the page (the hydration
// effect seeds them) and are passed in, as are the realtime room ref and
// the status/list setters.
export function useAutosave(opts: {
  hydrated: boolean;
  documentId: string | null;
  isReadOnly: boolean;
  tabs: Tab[];
  documentName: string;
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
  // How many peer ops this render's `tabs` include: state, bumped in the same batch that applies each op.
  opsApplied: number;
  // True while a hover-preview is on screen. Previews mutate `tabs` (so they
  // render live) but must never be persisted; the debounced save below skips
  // while this is set, and the click-commit clears it and saves normally.
  previewingRef: MutableRefObject<boolean>;
  roomRef: RefObject<ReturnType<typeof connectRoom> | null>;
  setSaveStatus: Dispatch<SetStateAction<SaveStatus>>;
  setSavedAt: Dispatch<SetStateAction<number | null>>;
  setDocumentList: Dispatch<SetStateAction<DocumentListItem[]>>;
  // A save refused because the document is in the Trash
  // (docs/specs/013-workspace/trash.md): writes stop, the editor shows why.
  onDocumentTrashed: () => void;
}) {
  const {
    hydrated,
    documentId,
    isReadOnly,
    tabs,
    documentName,
    selfId,
    sessionShareCode,
    lastSavedTabsRef,
    lastSavedNameRef,
    loadedTabIdsRef,
    remoteOpJournalRef,
    opsApplied,
    previewingRef,
    roomRef,
    setSaveStatus,
    setSavedAt,
    setDocumentList,
    onDocumentTrashed,
  } = opts;

  // The caller passes a fresh function each render; read it when a save is refused (an effect event), so
  // it never re-arms the debounced save.
  const reportTrashed = useEffectEvent(() => onDocumentTrashed());

  // Set once the server has told us we may not write to this document at all
  // (403). Unlike a network failure that's worth another go on the next edit,
  // this can never succeed: the share link was revoked, we were removed from
  // the team, or the role changed under us. Retrying anyway meant a user could
  // edit for an hour against a document that would never take the writes,
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
  // applying one always re-renders, and this value in the deps re-arms it. It is state (opsApplied, bumped
  // in the batch that applies each op), so render reads no ref.
  const opsInRender = opsApplied;

  // A different document gets a clean slate: the block is about THIS one.
  useEffect(() => {
    writesForbiddenRef.current = false;
  }, [documentId]);

  useEffect(() => {
    if (!hydrated || !documentId || isReadOnly) return;
    const handler = () => {
      // Nothing we send can be accepted; don't beacon on the way out either.
      if (writesForbiddenRef.current) return;
      // The user just deleted this document (navigating to /explorer fires
      // beforeunload): don't beacon its tabs/meta back and re-create it.
      if (isDocumentDeleted(documentId)) return;
      const { changedTabs, deletedIds, orderChanged, nameChanged, hasChanges } = computeTabSaveDiff(
        lastSavedTabsRef.current,
        tabs,
        lastSavedNameRef.current,
        documentName,
        loadedTabIdsRef.current,
      );
      if (!hasChanges) return;
      // The raw keepalive writes live behind the api-client boundary now
      // (flushDocumentSavesBeacon) so this hook holds no fetch of its own.
      flushDocumentSavesBeacon({
        ownerId: selfId,
        documentId,
        shareCode: sessionShareCode,
        changedTabs,
        deletedIds,
        loadedTabIds: loadedTabIdsRef.current,
        orderChanged,
        nameChanged,
        name: documentName,
        tabs,
      });
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [
    hydrated,
    documentId,
    isReadOnly,
    tabs,
    documentName,
    selfId,
    sessionShareCode,
    lastSavedTabsRef,
    lastSavedNameRef,
    loadedTabIdsRef,
  ]);

  useEffect(() => {
    if (!hydrated || !documentId) return;
    if (isReadOnly) return;
    // The server has already refused a write to this document. Every further
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
      // Bail if the document was just deleted (the debounce can still be
      // pending when the delete fires) so we don't re-create it.
      if (isDocumentDeleted(documentId)) return;
      const { changedTabs, deletedIds, orderChanged, nameChanged, hasChanges } = computeTabSaveDiff(
        lastSavedTabsRef.current,
        tabs,
        lastSavedNameRef.current,
        documentName,
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
      // What this client had seen of the room at the snapshot (docs/specs/012-collaboration/collab-race-hardening.md phase
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
          apiSaveTab(selfId, documentId, t, sessionShareCode, {
            // A loaded tab's content is authoritative, so an empty body is
            // an intentional clear (reset-canvas / delete-all) the server
            // backstop should accept; an unloaded placeholder is never in
            // the set, so it can't authorise its own wipe (docs/specs/006-document/per-tab-storage.md).
            allowEmpty: loadedTabIdsRef.current.has(t.id),
            roomCursor,
          }).then(() => {
            // Broadcast granular element ops (docs/specs/012-collaboration/realtime-conflict-resolution.md, Level 0) derived from
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
        writes.push(apiDeleteTab(selfId, documentId, tabId, sessionShareCode));
      }
      if (orderChanged || nameChanged) {
        writes.push(
          apiSaveDocumentMeta(
            selfId,
            {
              id: documentId,
              name: documentName,
              tabs: tabs.map((t) => ({ id: t.id, folder: t.folder })),
            },
            sessionShareCode,
          ).then(() => {
            roomRef.current?.send({
              kind: 'op',
              op: {
                kind: 'document-meta',
                name: documentName,
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
            const next = baselineAfterSave(journal, mark, tabs, documentName);
            lastSavedTabsRef.current = next.tabs;
            lastSavedNameRef.current = next.name;
          }
          setSaveStatus('saved');
          const now = Date.now();
          setSavedAt(now);
          // Bump the current document's row locally so the Explorer's
          // "Updated X ago" stays fresh — used to refetch the whole
          // list here, which hit /api/documents on every autosave.
          setDocumentList((prev) =>
            prev.map((d) => (d.id === documentId ? { ...d, savedAt: now, name: documentName } : d)),
          );
        })
        .catch((err: unknown) => {
          if (isDocumentTrashedError(err)) {
            writesForbiddenRef.current = true;
            reportTrashed();
            return;
          }
          reportSaveFailure(err);
          const status = saveFailureStatus(err);
          if (status === 'forbidden') writesForbiddenRef.current = true;
          setSaveStatus(status);
        })
        .finally(() => closeSaveWindow(journal));
    }, 600);
    return () => window.clearTimeout(handle);
  }, [
    hydrated,
    documentId,
    tabs,
    documentName,
    selfId,
    isReadOnly,
    sessionShareCode,
    opsInRender,
    lastSavedTabsRef,
    lastSavedNameRef,
    loadedTabIdsRef,
    previewingRef,
    remoteOpJournalRef,
    roomRef,
    setDocumentList,
    setSaveStatus,
    setSavedAt,
  ]);
}
