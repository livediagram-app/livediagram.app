import { useWorkbenchDocumentSession } from '@/components/providers/workbench-session-context';
import { surfaceFlags, type EditorSurface } from '../editor-surface';
import { useCallback, useMemo, useRef, useState } from 'react';
import { stampNewElementLayers, type Tab } from '@livedocuments/document';
import { settleChipsInTabs } from '@/lib/settle-tabs';
import { useAccountBootstrap } from '@/hooks/persistence/useAccountBootstrap';
import { useDocumentHistory } from '@/hooks/canvas/useDocumentHistory';
import { createTab } from '../editor-page-helpers';
import { guardLockedPagesIn, type PageLockGuard } from '@/lib/page-lock-guard';
import { announceTextOnly, guardFlashcardsIn } from '@/lib/flashcard-guard';

// The guards every local edit of the active tab passes (Pages mode): locked pages, then text-only
// flashcards (docs/specs/007-editor/flashcards.md "Text only"), each saying why after the commit.
const guardPagesIn = (prev: readonly Tab[], next: Tab[], guard: PageLockGuard | null): Tab[] =>
  guardFlashcardsIn(prev, guardLockedPagesIn(prev, next, guard), guard?.tabId ?? null, () =>
    queueMicrotask(() => announceTextOnly()),
  );

// The document itself: where the editor runs (surface), the signed-in account, the tabs and their undo history with
// the commit choke point every local edit passes (page locks, flashcards, badges, layer stamps), the tab summaries,
// and the document's load flags (found, failed, loading, joined).
//
// One slice of useEditorState (../useEditorState.ts), which calls the slices in order and passes each the ones
// before it.
export function useEditorDocument(opts: { surface?: EditorSurface } = {}) {
  // Unmemoised by the React Compiler, as the one hook it was cut from was (see ../useEditorState.ts).
  'use no memo';
  // Where the editor runs (editor-surface.ts). The read-only embed view (docs/specs/013-workspace/
  // embeds.md) forces view behaviour regardless of the share role, suppresses the visitor identity
  // screen, and EditorView swaps the chrome for the embed badge + tab switcher. A workbench
  // (docs/specs/013-workspace/blueprints/workbench-embeds.md "The editor in a workbench") is signed in
  // by its session and drops the app's surroundings and everything beyond its one document.
  // Constant for the lifetime of the page (it comes from which route mounted us), so it's safe in
  // derived consts.
  const surface = opts.surface ?? 'app';
  const { embedMode, workbenchMode, appChrome } = surfaceFlags(surface);
  const workbench = useWorkbenchDocumentSession();
  const initialTabs: Tab[] = [createTab('Tab 1')];

  // Embed page-view telemetry (docs/specs/013-workspace/embeds.md) is emitted by editor-page.tsx —
  // exactly one site, so an embed render can't be double-counted.

  // Sign-in wiring (token provider + guest→authed migration). One hook
  // does both — see `hooks/useAccountBootstrap.ts`. The values it
  // returns are the same ones `useAuth()` would; we read them via the
  // hook so the page has one source of truth.
  const { authLoaded, accountUserId, accountDisplayName } = useAccountBootstrap();

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
  } = useDocumentHistory(initialTabs);
  const canHistoryUndo = canTabUndo;
  const canHistoryRedo = canTabRedo;
  const undoHistory = tabUndo;
  const redoHistory = tabRedo;

  // Counts this person's own edits (never a remote op, an undo or a tick): what lets the documents
  // take in what was just added to a page (useArticleIntake) without taking a peer's.
  const localEditSeqRef = useRef(0);
  // Set once Pages mode's pages are known (below): the tab the lock guard applies to, and how
  // it says something was held back.
  const pageLockGuardRef = useRef<PageLockGuard | null>(null);
  // The active layer's stamp for commitTabs (docs/specs/006-document/layers.md), refreshed once the layers slice has
  // computed (useEditorLayers): declared here, before the commit choke point that reads it.
  const activeLayerStampRef = useRef<{ tabId: string; layerId: string } | null>(null);
  // A tick (a drag landing, a nudge, a resize, a slider) passes the same lock guard as a commit.
  // Stable, as the history's own tick is: effects and loaders depend on its identity.
  const tickTabs = useCallback(
    (mapTabs: (ts: Tab[]) => Tab[]) =>
      rawTickTabs((ts) =>
        guardPagesIn(ts, settleChipsInTabs(ts, mapTabs(ts)), pageLockGuardRef.current),
      ),
    [rawTickTabs],
  );
  const commitTabs = (mapTabs: (ts: Tab[]) => Tab[]) => {
    localEditSeqRef.current += 1;
    // Layer stamping (docs/specs/006-document/layers.md): elements APPEARING in this commit without
    // a valid layerId land on the active layer. One choke point, so no
    // individual creation path (draw, paste, template, Mermaid
    // import) carries layer logic. stampNewElementLayers no-ops on tabs
    // that never materialised `layers`, and on undo/remote applies (which
    // bypass commitTabs entirely).
    rawCommitTabs((ts) => {
      const mapped = mapTabs(ts);
      // Locked pages (docs/specs/007-editor/pages-mode.md "Locking a page"): in Pages
      // mode nothing is added to, moved onto, changed on or taken off a locked page.
      // Badges and step numbers (docs/specs/009-elements/badge.md "Attachment"), after the commit moved their hosts.
      const next = guardPagesIn(ts, settleChipsInTabs(ts, mapped), pageLockGuardRef.current);
      const stamp = activeLayerStampRef.current;
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
  // Whether the participant has explicitly confirmed their identity in a
  // modal at least once (either Create Document on the welcome flow, Skip,
  // or Join Document on the join flow). Persisted via localStorage so a
  // returning visitor isn't re-prompted. Brand new visitors landing on a
  // pre-existing document see the join flow until they confirm.
  const [nameConfirmed, setNameConfirmed] = useState(false);
  // True after hydration if we successfully loaded a saved document from
  // the API (i.e. the user is joining someone else's document, not
  // starting a fresh one). Drives the join-screen trigger.
  const [loadedExistingDocument, setLoadedExistingDocument] = useState(false);
  // True when the URL points at a document that the API didn't return
  // (deleted, never existed, or owned by someone else). Renders the
  // NotFound surface instead of the editor + welcome modal.
  const [documentNotFound, setDocumentNotFound] = useState(false);
  // Distinct from documentNotFound (a clean 404): the load call itself
  // FAILED (network down / 5xx), which is retryable. Drives ApiErrorPage.
  const [loadError, setLoadError] = useState(false);
  // Loading screen is the default — every first paint shows the
  // spinner, including SSG output, so users hitting a `?d=` / `?s=`
  // URL never glimpse the empty canvas and assume their data is gone.
  // The hydration useLayoutEffect flips it to false either immediately
  // (no URL params → straight to welcome modal) or once the API call
  // resolves (params → load the document first).
  const [loadingDocument, setLoadingDocument] = useState(true);

  return {
    surface,
    embedMode,
    workbenchMode,
    appChrome,
    workbench,
    initialTabs,
    authLoaded,
    accountUserId,
    accountDisplayName,
    tabs,
    applyRemoteTabs,
    applyRemoteOp,
    canHistoryUndo,
    canHistoryRedo,
    undoHistory,
    redoHistory,
    localEditSeqRef,
    pageLockGuardRef,
    activeLayerStampRef,
    tickTabs,
    commitTabs,
    markCheckpoint,
    resetTabs,
    cancelToCheckpoint,
    tabSummaries,
    nameConfirmed,
    setNameConfirmed,
    loadedExistingDocument,
    setLoadedExistingDocument,
    documentNotFound,
    setDocumentNotFound,
    loadError,
    setLoadError,
    loadingDocument,
    setLoadingDocument,
  };
}

export type EditorDocument = ReturnType<typeof useEditorDocument>;
