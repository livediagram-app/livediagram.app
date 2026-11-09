import { useItemUndo } from '@/hooks/plan/useItemUndo';
import { useCallback, useMemo, useState, useRef } from 'react';
import { type Tab, stampTabKind, stampNewElementLayers } from '@liveplanner/project';
import { settleChipsInTabs } from '@/lib/settle-tabs';
import { useProjectHistory } from '@/hooks/canvas/useProjectHistory';
import { type Participant, participantKey } from '@/lib/identity';
import { type RemoteOpJournal, createRemoteOpJournal } from '../save-baseline';
import { type OwnElementWrites, createOwnElementWrites } from '../own-element-writes';
import type { EditorEnvSlice } from './useEditorEnv';
import type { EditorSelectionSlice } from './useEditorSelection';
import type { EditorLate } from './editor-late';

// A slice of the editor's state, composed by useEditorState in a fixed order (docs/development/architecture.md
// "The editor's shape"). It takes the slices composed before it and returns what the slices after it, and the
// view (editor-view.ts), read. Its hooks run in the order they did in the one hook this was split from, so the
// effects keep their order.
//
// The document: the tabs and their undo timeline (items take their turn in it), the commit and tick choke
// points every edit goes through, the tabs' id and name summary, and the load state (the project id, hydration,
// which tabs have loaded or failed, not found, the load error), the local participant and the last-saved
// baseline the autosave diffs against.
export function useEditorDocument(
  env: EditorEnvSlice,
  selectionSlice: EditorSelectionSlice,
  late: Pick<EditorLate, 'activeLayerStampRef'>,
) {
  const { initialTabs } = env;
  const { activeId } = selectionSlice;
  const {
    tabs,
    canUndo: canTabUndo,
    canRedo: canTabRedo,
    commit: rawCommitTabs,
    tick: rawTickTabs,
    markCheckpoint: rawMarkCheckpoint,
    cancelToCheckpoint: rawCancelToCheckpoint,
    reset: rawResetTabs,
    applyRemote: applyRemoteTabs,
    applyRemoteOp,
    undo: tabUndo,
    redo: tabRedo,
    depth: historyDepth,
    branch: historyBranch,
    futureLength: historyFutureLength,
    clearRedo: clearHistoryRedo,
  } = useProjectHistory(initialTabs);
  // Item changes take their turn in the same undo timeline (docs/specs/026-plan/items.md "Undo").
  const itemUndo = useItemUndo({
    depth: historyDepth,
    branch: historyBranch,
    futureLength: historyFutureLength,
    canUndo: canTabUndo,
    canRedo: canTabRedo,
    undo: tabUndo,
    redo: tabRedo,
    clearRedo: clearHistoryRedo,
  });
  const {
    canUndo: canHistoryUndo,
    canRedo: canHistoryRedo,
    undo: undoHistory,
    redo: redoHistory,
  } = itemUndo;

  // A tick (a drag landing, a nudge, a resize, a slider) settles chips as a commit does.
  // Stable, as the history's own tick is: effects and loaders depend on its identity.
  const tickTabs = useCallback(
    (mapTabs: (ts: Tab[]) => Tab[]) => rawTickTabs((ts) => settleChipsInTabs(ts, mapTabs(ts))),
    [rawTickTabs],
  );
  const commitTabs = (mapTabs: (ts: Tab[]) => Tab[]) => {
    // Layer stamping (docs/specs/006-project/layers.md): elements APPEARING in this commit without
    // a valid layerId land on the active layer. One choke point, so no
    // individual creation path (draw, paste, template, Mermaid
    // import) carries layer logic. stampNewElementLayers no-ops on tabs
    // that never materialised `layers`, and on undo/remote applies (which
    // bypass commitTabs entirely).
    rawCommitTabs((ts) => {
      // Tab kind: a committed tab says what KIND of board it
      // is, rather than leaving a reader to know that absence means
      // 'diagram'. Same choke point as the layer stamp below, and
      // `stampTabKind` returns the tab unchanged when it already has one,
      // so an untouched tab keeps its identity for the memoised views. Only the tabs this commit changed or added
      // are stamped: an untouched tab may be a placeholder whose content has not loaded, and stamping it would make
      // it look edited to the autosave (docs/specs/006-project/per-tab-storage.md).
      const before = new Set<Tab>(ts);
      const mapped = mapTabs(ts).map((t) => (before.has(t) ? t : stampTabKind(t)));
      // Badges and step numbers (docs/specs/009-elements/badge.md "Attachment"), after the commit moved their hosts.
      const next = settleChipsInTabs(ts, mapped);
      const stamp = late.activeLayerStampRef().current;
      if (!stamp) return next;
      return next.map((t) => {
        if (t.id !== stamp.tabId) return t;
        const prev = ts.find((p) => p.id === t.id);
        const els = stampNewElementLayers(
          prev?.elements ?? [],
          t.elements,
          t.layers,
          stamp.layerId,
        );
        return els === t.elements ? t : { ...t, elements: els };
      });
    });
  };
  const markCheckpoint = rawMarkCheckpoint;
  // Stable identity: usePerTabLoad takes this, and an identity that changed
  // every render once turned a failed tab load into a refetch on every
  // re-render (the 30s presence tick included), each one an Error report.
  const resetTabs = rawResetTabs;
  // Escape-cancel for an in-flight drag: restore the gesture's
  // checkpoint and DISCARD the step (no redo entry, a cancelled drag
  // never happened).
  const cancelToCheckpoint = rawCancelToCheckpoint;

  // Stable id + name projection of the tabs for link-badge hover cards
  // (docs/specs/008-canvas/canvas-and-palette.md): keyed on a signature so it only changes when a tab is
  // added / removed / renamed, NOT on every element edit, keeping the
  // memoised element views from re-rendering as the user types.
  //
  // NUL and SOH separate the fields because neither can occur in an id or a
  // name, so no rename can forge a signature by containing the delimiter.
  // Written as ESCAPES, not literal bytes: as raw bytes they made this the
  // only non-text file in the repo, `file` reported it as `data`, and
  // ripgrep answered every search of it with "binary file matches" and moved
  // on. On the 2,800-line module that composes every editor hook and builds
  // EditorContext, that silently broke "find all usages": a dead-code sweep
  // saw a hook's definition and no callers, because every call site is in
  // here. Same runtime string, searchable source.
  const tabSig = tabs.map((t) => `${t.id}\u0000${t.name}`).join('\u0001');
  const tabSummaries = useMemo(
    () =>
      tabSig === ''
        ? []
        : tabSig.split('\u0001').map((entry) => {
            const [id = '', name = ''] = entry.split('\u0000');
            return { id, name };
          }),
    [tabSig],
  );
  // identityPromptOpen (from useEditorUiState) gates the derived
  // `identityOnlyScreenOpen` chrome flag; it closes through useTemplateFlow's
  // `confirmIdentity` / `cancelIdentity`.
  // Whether the participant has explicitly confirmed their identity in a
  // modal at least once (either Create Project on the welcome flow, Skip,
  // or Join Project on the join flow). Persisted via localStorage so a
  // returning visitor isn't re-prompted. Brand new visitors landing on a
  // pre-existing project see the join flow until they confirm.
  const [nameConfirmed, setNameConfirmed] = useState(false);
  // True after hydration if we successfully loaded a saved project from
  // the API (i.e. the user is joining someone else's project, not
  // starting a fresh one). Drives the join-screen trigger.
  const [loadedExistingProject, setLoadedExistingProject] = useState(false);
  // True when the URL points at a project that the API didn't return
  // (deleted, never existed, or owned by someone else). Renders the
  // NotFound surface instead of the editor + welcome modal.
  const [projectNotFound, setProjectNotFound] = useState(false);
  // Distinct from projectNotFound (a clean 404): the load call itself
  // FAILED (network down / 5xx), which is retryable. Drives ApiErrorPage.
  const [loadError, setLoadError] = useState(false);
  // Loading screen is the default — every first paint shows the
  // spinner, including SSG output, so users hitting a `?d=` / `?s=`
  // URL never glimpse the empty canvas and assume their data is gone.
  // The hydration useLayoutEffect flips it to false either immediately
  // (no URL params → straight to welcome modal) or once the API call
  // resolves (params → load the project first).
  const [loadingProject, setLoadingProject] = useState(true);
  // Local-session participant. Initialised to a stable placeholder so the
  // SSG output and the first client paint agree (Math.random() in a lazy
  // initialiser ran on both server and client and produced different
  // names, tripping React's hydration mismatch). The post-mount hydration
  // step below either loads a saved identity or mints a fresh random one
  // — both happen synchronously inside useLayoutEffect, so the user never
  // sees the placeholder.
  const [selfParticipant, setSelfParticipant] = useState<Participant>({
    id: 'self',
    name: 'Guest',
    color: '#0ea5e9',
    status: 'online',
  });
  // Who "I" am in a dot vote (docs/specs/012-collaboration/collab-race-hardening.md): the collab key, which is stable and
  // safe to publish, rather than the owner id, which is a guest's credential.
  const voteSelfId = participantKey(selfParticipant);
  // Dismissing a "shared with you" row lives in useProjectListActions
  // (via useProjectActions below), shared with /explorer and /new.
  // Tab ids whose full payload has been fetched. Hydration loads the
  // active tab inline; the rest pop in lazily when the user switches
  // to them. Tracked in a ref because it's only ever read inside the
  // effects, not rendered.
  const loadedTabIdsRef = useRef<Set<string>>(new Set());
  // Mirror of the ref above into reactive state, used by the JSX
  // gate that hides the template picker until the active tab's
  // content has actually been fetched. Without this the user sees
  // a "pick a template" flash on every fresh tab open: hydration
  // gives them the empty placeholder (elements.length === 0,
  // templateChosen unset), the picker renders, then the lazy fetch
  // resolves and the picker hides. Re-rendering on every change
  // would be wasteful; we only update this set after a
  // hydration / fetch lands, so the renders are bounded.
  const [loadedTabIds, setLoadedTabIds] = useState<Set<string>>(new Set());
  // Tab ids whose lazy fetch FAILED (network / 5xx — not a 404). Drives
  // the canvas's blocking error overlay so the user can't edit a blank
  // placeholder and have the autosave wipe the real server row (docs/specs/006-project/per-tab-storage.md).
  // `tabLoadRetryNonce` lets the Retry button re-run usePerTabLoad's
  // effect for the same active tab (deps otherwise unchanged).
  const [tabLoadErrors, setTabLoadErrors] = useState<Set<string>>(new Set());
  const [tabLoadRetryNonce, setTabLoadRetryNonce] = useState(0);
  // Mark a tab as loaded — its content is authoritative in local state,
  // so usePerTabLoad must skip it. Used by hydration and by the
  // locally-created tab paths (add / duplicate / import): those have no
  // server row to fetch yet, so without this they'd flash the loader
  // overlay (and never resolve, since the fetch 404s). Keeping them out
  // of the lazy-load path also makes the per-tab template picker fire
  // deterministically for a fresh tab.
  const markTabLoaded = (id: string) => {
    loadedTabIdsRef.current.add(id);
    setLoadedTabIds((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
  };
  // Re-attempt the active tab's failed lazy fetch. Clear its error so
  // the overlay swaps from the error card to the spinner, drop it from
  // the loaded-set so the effect actually refetches, then bump the nonce
  // to re-run that effect even though activeId hasn't changed.
  const retryActiveTabLoad = () => {
    loadedTabIdsRef.current.delete(activeId);
    setTabLoadErrors((prev) => {
      if (!prev.has(activeId)) return prev;
      const next = new Set(prev);
      next.delete(activeId);
      return next;
    });
    setTabLoadRetryNonce((n) => n + 1);
  };
  // Persistent project id. `null` until the post-mount hydration step
  // runs; that step reads ?d=<id> from the URL (or mints a fresh id +
  // updates the URL) and pulls any saved tabs + name from localStorage.
  // Saves are gated on `hydrated` so we never overwrite stored data
  // with the empty initial render.
  const [projectId, setProjectId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // Per-tab autosave. The previous snapshot lives in a ref so we can
  // diff: any tab whose object reference changed since last save is
  // ours to PUT; tab order / project rename hit the metadata PUT.
  // Debounced 600ms — feels responsive without hammering the API.
  // docs/specs/006-project/per-tab-storage.md has the design.
  const lastSavedTabsRef = useRef<Tab[]>([]);
  const lastSavedNameRef = useRef<string>('');
  // Peer ops that land while a save is in flight (docs/specs/012-collaboration/collab-race-hardening.md); see save-baseline.
  const remoteOpJournalRef = useRef<RemoteOpJournal>(createRemoteOpJournal());
  // This editor's element writes the room has not sequenced yet (own-element-writes.ts): one stable object.
  const [ownWrites] = useState<OwnElementWrites>(createOwnElementWrites);
  // Peer ops applied to `tabs`, as state: the journal's count as of this render, for the autosave.
  const [opsApplied, setOpsApplied] = useState(0);
  const countAppliedOp = useCallback(() => setOpsApplied((n) => n + 1), []);

  // True while a hover-preview is on screen (set by useStylePreview). Style
  // previews mutate `tabs` via tickTabs so they render live, but they must
  // never be persisted — only the click-commit should. Autosave reads this
  // ref to skip the debounced save while a preview is showing.
  const previewingRef = useRef(false);
  return {
    applyRemoteOp,
    applyRemoteTabs,
    canHistoryRedo,
    canHistoryUndo,
    cancelToCheckpoint,
    commitTabs,
    countAppliedOp,
    hydrated,
    itemUndo,
    lastSavedNameRef,
    lastSavedTabsRef,
    loadError,
    loadedExistingProject,
    loadedTabIds,
    loadedTabIdsRef,
    loadingProject,
    markCheckpoint,
    markTabLoaded,
    nameConfirmed,
    opsApplied,
    ownWrites,
    previewingRef,
    projectId,
    projectNotFound,
    redoHistory,
    remoteOpJournalRef,
    resetTabs,
    retryActiveTabLoad,
    selfParticipant,
    setHydrated,
    setLoadError,
    setLoadedExistingProject,
    setLoadedTabIds,
    setLoadingProject,
    setNameConfirmed,
    setProjectId,
    setProjectNotFound,
    setSelfParticipant,
    setTabLoadErrors,
    tabLoadErrors,
    tabLoadRetryNonce,
    tabSummaries,
    tabs,
    tickTabs,
    undoHistory,
    voteSelfId,
  };
}

export type EditorDocumentSlice = ReturnType<typeof useEditorDocument>;
