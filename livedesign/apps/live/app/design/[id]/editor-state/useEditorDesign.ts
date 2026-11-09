import { useWorkbenchDesignSession } from '@/components/providers/workbench-session-context';
import { surfaceFlags, type EditorSurface } from '@liveworkspace/workbench/lib/editor-surface';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  stampSessionMembers,
  stampTabKind,
  stampNewElementLayers,
  type Tab,
} from '@livedesign/design';
import { settleChipsInTabs } from '@/lib/settle-tabs';
import { useAccountBootstrap } from '@/hooks/persistence/useAccountBootstrap';
import { useDesignHistory } from '@/hooks/canvas/useDesignHistory';
import { createTab } from '../editor-page-helpers';
import { guardLockedPagesIn, type PageLockGuard } from '@/lib/page-lock-guard';

// The design itself: where the editor runs (surface), the signed-in account, the tabs and their undo history with
// the commit choke point every local edit passes (page locks, badges, layer stamps), the component sessions this
// editor owns, the tab summaries, and the design's load flags (found, failed, loading, joined).
//
// One slice of useEditorState (../useEditorState.ts), which calls the slices in order and passes each the ones
// before it.
export function useEditorDesign(opts: { surface?: EditorSurface } = {}) {
  // Where the editor runs (editor-surface.ts). The read-only embed view (docs/specs/013-workspace/
  // embeds.md) forces view behaviour regardless of the share role, suppresses the visitor identity
  // screen, and EditorView swaps the chrome for the embed badge + tab switcher. A workbench
  // (docs/specs/013-workspace/blueprints/workbench-embeds.md "The editor in a workbench") is signed in
  // by its session and drops the app's surroundings and everything beyond its one design.
  // Constant for the lifetime of the page (it comes from which route mounted us), so it's safe in
  // derived consts.
  const surface = opts.surface ?? 'app';
  const { embedMode, workbenchMode, appChrome } = surfaceFlags(surface);
  const workbench = useWorkbenchDesignSession();
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
    // The history's place, which a photo page's History reads (docs/specs/031-photo/photo-pages.md).
    depth: historyDepth,
    branch: historyBranch,
  } = useDesignHistory(initialTabs);
  const canHistoryUndo = canTabUndo;
  const canHistoryRedo = canTabRedo;
  const undoHistory = tabUndo;
  const redoHistory = tabRedo;

  // Set once Pages mode's pages are known (below): the tab the lock guard applies to, and how
  // it says something was held back.
  const pageLockGuardRef = useRef<PageLockGuard | null>(null);
  // The active layer's stamp for commitTabs (docs/specs/006-design/layers.md), refreshed once the layers slice has
  // computed (useEditorLayers): declared here, before the commit choke point that reads it.
  const activeLayerStampRef = useRef<{ tabId: string; layerId: string } | null>(null);
  // The component edit sessions this screen opened, the only ones it derives live (useComponentSession).
  const ownedComponentSessions = useRef(new Set<string>());
  // A tick (a drag landing, a nudge, a resize, a slider) passes the same lock guard as a commit.
  // Stable, as the history's own tick is: effects and loaders depend on its identity.
  const tickTabs = useCallback(
    (mapTabs: (ts: Tab[]) => Tab[]) =>
      rawTickTabs((ts) =>
        guardLockedPagesIn(ts, settleChipsInTabs(ts, mapTabs(ts)), pageLockGuardRef.current),
      ),
    [rawTickTabs],
  );
  const commitTabs = (mapTabs: (ts: Tab[]) => Tab[]) => {
    // Layer stamping (docs/specs/006-design/layers.md): elements APPEARING in this commit without
    // a valid layerId land on the active layer. One choke point, so no
    // individual creation path (draw, paste, template) carries layer logic. stampNewElementLayers no-ops on tabs
    // that never materialised `layers`, and on undo/remote applies (which
    // bypass commitTabs entirely).
    rawCommitTabs((ts) => {
      // Tab kind: a committed tab says what KIND of board it
      // is, rather than leaving a reader to know that absence means
      // 'diagram'. Same choke point as the layer stamp below, and
      // `stampTabKind` returns the tab unchanged when it already has one,
      // so an untouched tab keeps its identity for the memoised views. Only the tabs this commit changed or added
      // are stamped: an untouched tab may be a placeholder whose content has not loaded, and stamping it would make
      // it look edited to the autosave (docs/specs/006-design/per-tab-storage.md).
      const before = new Set<Tab>(ts);
      const mapped = mapTabs(ts).map((t) => (before.has(t) ? t : stampTabKind(t)));
      // Locked pages (docs/specs/007-editor/pages-mode.md "Locking a page"): in Pages
      // mode nothing is added to, moved onto, changed on or taken off a locked page.
      // Badges and step numbers (docs/specs/009-elements/badge.md "Attachment"), after the commit moved their hosts.
      const guarded = guardLockedPagesIn(
        ts,
        settleChipsInTabs(ts, mapped),
        pageLockGuardRef.current,
      );
      // An open component edit session (docs/specs/009-elements/components.md "Editing the main"): what this commit
      // adds to a changed tab joins the session. stampSessionMembers returns the elements as they are with no session.
      const next = guarded.map((t) => {
        if (before.has(t)) return t;
        const prev = ts.find((p) => p.id === t.id);
        if (!prev) return t;
        const els = stampSessionMembers(prev.elements, t.elements);
        return els === t.elements ? t : { ...t, elements: els };
      });
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
  // modal at least once (either Create Design on the welcome flow, Skip,
  // or Join Design on the join flow). Persisted via localStorage so a
  // returning visitor isn't re-prompted. Brand new visitors landing on a
  // pre-existing design see the join flow until they confirm.
  const [nameConfirmed, setNameConfirmed] = useState(false);
  // True after hydration if we successfully loaded a saved design from
  // the API (i.e. the user is joining someone else's design, not
  // starting a fresh one). Drives the join-screen trigger.
  const [loadedExistingDesign, setLoadedExistingDesign] = useState(false);
  // True when the URL points at a design that the API didn't return
  // (deleted, never existed, or owned by someone else). Renders the
  // NotFound surface instead of the editor + welcome modal.
  const [designNotFound, setDesignNotFound] = useState(false);
  // Distinct from designNotFound (a clean 404): the load call itself
  // FAILED (network down / 5xx), which is retryable. Drives ApiErrorPage.
  const [loadError, setLoadError] = useState(false);
  // Loading screen is the default — every first paint shows the
  // spinner, including SSG output, so users hitting a `?d=` / `?s=`
  // URL never glimpse the empty canvas and assume their data is gone.
  // The hydration useLayoutEffect flips it to false either immediately
  // (no URL params → straight to welcome modal) or once the API call
  // resolves (params → load the design first).
  const [loadingDesign, setLoadingDesign] = useState(true);

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
    historyDepth,
    historyBranch,
    canHistoryUndo,
    canHistoryRedo,
    undoHistory,
    redoHistory,
    pageLockGuardRef,
    activeLayerStampRef,
    ownedComponentSessions,
    tickTabs,
    commitTabs,
    markCheckpoint,
    resetTabs,
    cancelToCheckpoint,
    tabSummaries,
    nameConfirmed,
    setNameConfirmed,
    loadedExistingDesign,
    setLoadedExistingDesign,
    designNotFound,
    setDesignNotFound,
    loadError,
    setLoadError,
    loadingDesign,
    setLoadingDesign,
  };
}

export type EditorDesignSlice = ReturnType<typeof useEditorDesign>;
