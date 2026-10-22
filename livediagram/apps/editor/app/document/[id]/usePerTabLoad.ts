import {
  useCallback,
  useEffect,
  useRef,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from 'react';
import type { Tab } from '@livediagram/document';
import { apiLoadTabRevisioned } from '@/lib/api-client';
import { isTabOutOfScope } from '@/lib/tab-scope';
import { track } from '@/lib/telemetry';
import { startEditorTiming } from '@/lib/timing';
import { useLatest } from '@/hooks/ui/useLatest';

// Lazy per-tab content load (docs/specs/006-document/per-tab-storage.md), lifted out of editor-page.tsx.
// Hydration seeds the first tab; switching to a never-opened tab fires a
// one-shot GET that merges the elements into local state. Failures fall
// back to the placeholder so the editor doesn't lock up. The loaded-set
// ref + its reactive mirror are seeded by hydration and passed in, as is
// applyLoaded (which puts content in place without touching undo) and the remote-update guard ref.
//
// Also returns `loadAllTabs`, the search panel's prefetch (docs/specs/008-canvas/canvas-and-palette.md
// "Search panel"): element search walks local tab state, so unvisited
// placeholders would silently miss; opening search pulls every
// remaining tab's content in one parallel sweep.
// A tab the user has already drawn on keeps its local content over a late fetch. An empty placeholder has nothing to
// keep: a dismissed Quick Start (`templateChosen`) on it once kept the fetched content out while the tab still counted
// as loaded, and the autosave then saved the empty placeholder over the stored tab
// (docs/specs/006-document/per-tab-storage.md).
function userHasEdited(t: Tab): boolean {
  return t.elements.length > 0;
}

// How a tab's fetch ended: its content landed (or the screen kept its own), it failed, or it was dropped because
// the visit that started it moved on.
type TabFetchEnd = 'loaded' | 'failed' | 'cancelled';
// How many times loadAllTabs follows a tab's fetch from one cancelled run to the next before leaving it.
const TAB_FETCH_FOLLOW_MAX = 3;

export function usePerTabLoad(opts: {
  hydrated: boolean;
  documentId: string | null;
  activeId: string;
  selfId: string;
  sessionShareCode: string | null;
  // A tab-scoped share session's tab (docs/specs/013-workspace/tab-scoped-share-links.md): the search sweep
  // skips every other tab, whose content the server won't serve.
  sessionTabScope: string | null;
  // Latest tabs, mirrored to a ref by the page so loadAllTabs can
  // enumerate ids without re-creating itself on every tabs change.
  tabsRef: MutableRefObject<Tab[]>;
  loadedTabIdsRef: MutableRefObject<Set<string>>;
  setLoadedTabIds: Dispatch<SetStateAction<Set<string>>>;
  // Tabs whose lazy fetch FAILED (network / 5xx). Drives the canvas
  // error overlay so the user can't edit a blank placeholder and wipe
  // the real server row (docs/specs/006-document/per-tab-storage.md). Bumping `retryNonce` re-runs the
  // effect for the same active tab (the Retry button).
  setTabLoadErrors: Dispatch<SetStateAction<Set<string>>>;
  retryNonce: number;
  // The autosave's baseline. Content fetched from D1 is by definition saved,
  // so it lands here too, or the next save would PUT and broadcast the whole
  // tab back as if we had just drawn it (docs/specs/012-collaboration/collab-race-hardening.md).
  lastSavedTabsRef: MutableRefObject<Tab[]>;
  // Puts fetched content in place in the present AND every undo / redo snapshot (the history's applyRemoteOp), so a
  // tab loading for the first time (on opening it, or the search and Plan prefetch) never clears the undo history:
  // a snapshot holding the tab's empty placeholder takes the loaded content too, so an undo can never put the
  // placeholder back over it (and the autosave save it, empty, over the stored tab). `apply` returns its input
  // when it changes nothing.
  applyLoaded: (apply: (tabs: Tab[]) => Tab[]) => void;
  // Records what a tab put in place holds of the changesets (useChangesetSeen): every changeset
  // up to the revision it was read at. Stable.
  noteChangesetSeen: (tabId: string, rev: number) => void;
}) {
  const {
    hydrated,
    documentId,
    activeId,
    selfId,
    sessionShareCode,
    sessionTabScope,
    tabsRef,
    loadedTabIdsRef,
    setLoadedTabIds,
    setTabLoadErrors,
    retryNonce,
    lastSavedTabsRef,
    applyLoaded,
    noteChangesetSeen,
  } = opts;

  // applyLoaded is read through a ref, not listed as an effect dep. The load
  // effect must re-run only for a genuine reason (the tab, the document, the
  // identity, or the Retry nonce). When it listed the history setter and the caller
  // passed a fresh function each render, every re-render (the 30s presence
  // tick among them) tore the effect down and refetched; on a tab whose load
  // had FAILED that meant a refetch, and an Error telemetry report, twice a
  // minute for as long as the tab stayed open (docs/specs/017-telemetry/telemetry.md).
  const applyLoadedRef = useLatest(applyLoaded);
  // Read by the search sweep when a fetch fails (see loadAllTabs).
  const activeIdRef = useLatest(activeId);

  // Put a fetched tab in place: on screen, over a placeholder the user hasn't
  // touched (a tab they already drew on keeps its local content), and in the
  // autosave's baseline under the same rule, since content fetched from D1 is
  // by definition saved (docs/specs/012-collaboration/collab-race-hardening.md). Either way the local folder stays: it's
  // per-document link metadata (docs/specs/006-document/tab-folders.md) owned by the meta path, not the
  // content fetch. The baseline decision reads the last render (tabsRef), not
  // the state updater, which React may run late or twice.
  // Reads only refs, so it is stable and both loaders below can list it.
  // Returns whether the tab now counts as loaded: its fetched content landed, or what is on screen already holds
  // content of its own. A placeholder that only looks edited (Quick Start chosen, nothing drawn) and so kept itself over
  // the fetched content is NOT loaded: counting it would let the autosave save it, empty, over the stored tab.
  const adoptLoadedTab = useCallback(
    ({ tab, rev }: { tab: Tab; rev: number }): boolean => {
      const onScreen = tabsRef.current.find((t) => t.id === tab.id);
      if (onScreen && !userHasEdited(onScreen)) {
        lastSavedTabsRef.current = lastSavedTabsRef.current.map((t) =>
          t.id === tab.id ? { ...tab, folder: t.folder } : t,
        );
        noteChangesetSeen(tab.id, rev);
      }
      applyLoadedRef.current((prev) => {
        const at = prev.findIndex((t) => t.id === tab.id);
        const was = at < 0 ? undefined : prev[at]!;
        if (!was || userHasEdited(was)) return prev;
        const next = [...prev];
        next[at] = { ...tab, folder: was.folder };
        return next;
      });
      return !onScreen || !userHasEdited(onScreen) || onScreen.elements.length > 0;
    },
    [tabsRef, lastSavedTabsRef, applyLoadedRef, noteChangesetSeen],
  );

  // The attempt that last failed, keyed on everything that makes a fetch
  // worth repeating. A failed load stays failed (the error overlay stays up)
  // until that key changes: Retry bumps the nonce, or the user moves to
  // another tab / document / identity. Belt and braces over the dep list, so
  // an unstable dep can never again turn a failure into a refetch loop.
  const failedAttemptRef = useRef<string | null>(null);

  // The tabs whose fetch is in flight, kept apart from the loaded-set: a tab joins `loadedTabIdsRef` only once its
  // content is in place. The loaded-set is what lets the autosave save a tab (computeTabSaveDiff) and send it empty
  // (X-Allow-Empty), so claiming a tab there before its GET answered let a commit that touched every tab (the kind
  // stamp in commitTabs) save the empty placeholder over the real row while the Plan sweep was in flight.
  const fetchingTabIdsRef = useRef<Set<string>>(new Set());
  // How each fetch under way ends, by tab: so a caller asking for a tab another fetch is already loading waits for
  // that one and hears how it went, rather than answering at once with neither the tab nor a failure (which left
  // the caller asking again on a timer).
  const inFlightRef = useRef<Map<string, Promise<TabFetchEnd>>>(new Map());
  // Note a fetch under way and how it ends; forgotten once it has.
  const noteInFlight = useCallback((targetId: string, run: Promise<TabFetchEnd>) => {
    const inFlight = inFlightRef.current;
    const settled = run.finally(() => {
      if (inFlight.get(targetId) === settled) inFlight.delete(targetId);
    });
    inFlight.set(targetId, settled);
  }, []);

  useEffect(() => {
    if (!hydrated || !documentId) return;
    const attemptKey = JSON.stringify([documentId, activeId, selfId, sessionShareCode, retryNonce]);
    if (failedAttemptRef.current === attemptKey) return;
    // Any other key forgets the failure, even when this run then bails on an
    // already-loaded tab: switching away and back to the failed tab retries.
    failedAttemptRef.current = null;
    if (loadedTabIdsRef.current.has(activeId) || fetchingTabIdsRef.current.has(activeId)) return;
    let cancelled = false;
    const fetching = fetchingTabIdsRef.current;
    fetching.add(activeId);
    // Track whether we actually consumed the API response. Cleanup
    // checks this flag — if the effect was torn down before it could
    // merge (StrictMode double-invoke, fast activeId switch, etc.),
    // we remove the id from the loaded-set so the next effect run
    // can retry instead of skipping forever. Without this, Tab 2
    // reliably loaded as empty: first effect added the id, then the
    // cleanup cancelled the in-flight fetch, then the second effect
    // saw the id in the set and bailed. The id is in the fetching-set
    // until then, and joins the loaded-set only with its content.
    let merged = false;
    const targetId = activeId;
    // Capture the ref value at effect-run time so the cleanup uses
    // the same Set the effect itself populated (avoids the lint
    // warning about ref values shifting between effect and cleanup).
    const loadedTabIds = loadedTabIdsRef.current;
    // Drop any prior failure marker for this tab now that a fresh
    // attempt is under way, so a successful retry clears the error
    // overlay rather than leaving it stuck.
    const clearError = () =>
      setTabLoadErrors((prev) => {
        if (!prev.has(targetId)) return prev;
        const next = new Set(prev);
        next.delete(targetId);
        return next;
      });
    // How long the switch took (docs/specs/017-telemetry/timing-telemetry.md): the fetch to the first
    // frame with the content in place. Only the loads that count Tab·Loaded; a failure records nothing.
    const timing = startEditorTiming('TabLoad');
    const run = apiLoadTabRevisioned(selfId, documentId, targetId, sessionShareCode)
      .then((loaded): TabFetchEnd => {
        if (cancelled) return 'cancelled';
        if (!loaded) {
          // A null result is a 404 — the tab ROW is missing. We used to
          // treat that as "genuinely empty", mark the tab loaded, and drop
          // the loader. That was a data-loss trap: a *legitimately* empty
          // tab returns 200 with `{ elements: [] }` (the row still
          // exists), and the tab we're loading is the active tab, which is
          // ALWAYS in the document summary we hydrated from. So a 404 here
          // is anomalous — a mis-routed / transient 404, a share-code /
          // auth edge, or a row deleted out from under a stale summary —
          // NOT proof the tab is empty. Marking it loaded-and-empty would
          // arm the autosave to overwrite the real row with `{ elements:
          // [] }`. Route it to the same blocking retry overlay as a 5xx so
          // a wrong 404 can never wipe content; merged stays false so the
          // cleanup drops the optimistic id and Retry refetches.
          fetching.delete(targetId);
          failedAttemptRef.current = attemptKey;
          setTabLoadErrors((prev) => (prev.has(targetId) ? prev : new Set(prev).add(targetId)));
          return 'failed';
        }
        clearError();
        // Telemetry (docs/specs/017-telemetry/telemetry.md): a tab's content was fetched because the
        // user switched to it. The first tab of each document is counted
        // at hydration (useIdentityBootstrap), and it's already in the
        // loaded-set here so this effect bails for it — no double count.
        // The search prefetch (loadAllTabs below) deliberately doesn't
        // emit: it's a background sweep, not a user viewing a tab.
        track('Tab', 'Loaded');
        if (adoptLoadedTab(loaded)) loadedTabIds.add(targetId);
        fetching.delete(targetId);
        timing.endAfterPaint();
        // Either way the load is now committed — local state has been
        // consulted. Keep the id in the loaded-set so subsequent
        // tab switches don't refetch.
        merged = true;
        // Mirror into reactive state so the template-picker gate
        // can wait on this without rebuilding the ref-based dedupe
        // logic. Suppresses the brief "pick a template" flash that
        // used to render between hydration and the fetch landing.
        setLoadedTabIds((prev) => {
          if (prev.has(targetId)) return prev;
          return new Set(prev).add(targetId);
        });
        return 'loaded';
      })
      .catch((): TabFetchEnd => {
        if (cancelled) return 'cancelled';
        // Network / 5xx. Drop the id from the loaded-set so a later tab
        // switch (or the Retry button via retryNonce) refetches, and
        // flag it so the canvas shows the blocking error overlay instead
        // of an editable blank canvas. Only those refetch: the attempt
        // key below stops a mere re-render from retrying.
        fetching.delete(targetId);
        failedAttemptRef.current = attemptKey;
        setTabLoadErrors((prev) => (prev.has(targetId) ? prev : new Set(prev).add(targetId)));
        return 'failed';
      });
    noteInFlight(targetId, run);
    return () => {
      cancelled = true;
      timing.cancel();
      // StrictMode double-invoke + cleanup-before-promise-resolve
      // used to lock the tab in "loaded but empty" state forever:
      // the first run added the id and was cancelled before the
      // response arrived; the second run saw the id in the set and
      // bailed; the user never saw the real content. Drop the id
      // here so the next run actually fetches.
      if (!merged) fetching.delete(targetId);
    };
    // applyLoaded is read through applyLoadedRef on purpose (see above); the refs and setters listed are stable.
  }, [
    hydrated,
    documentId,
    activeId,
    selfId,
    sessionShareCode,
    retryNonce,
    adoptLoadedTab,
    loadedTabIdsRef,
    setLoadedTabIds,
    setTabLoadErrors,
    noteInFlight,
  ]);

  // One-shot parallel fetch of every not-yet-loaded tab, so element
  // search covers the whole document instead of just the tabs the user
  // happened to visit. Same merge semantics as the single-tab effect
  // above (skip user-edited tabs, keep the local folder, flag the
  // remote-update guard). Best-effort: a failed fetch just drops the
  // id back out of the loaded-set so the normal visit-time load (with
  // its error overlay) retries; search shouldn't surface blocking
  // errors for tabs the user isn't even looking at.
  // `only` narrows the sweep to the given tabs: the side by side pane (docs/specs/007-editor/split-view.md)
  // fetches the one tab it shows, with the same merge rules.
  const loadAllTabs = useCallback(
    async (only?: readonly string[]): Promise<string[]> => {
      if (!hydrated || !documentId) return [];
      const loadedTabIds = loadedTabIdsRef.current;
      const fetching = fetchingTabIdsRef.current;
      // A failed sweep fetch is silent for a tab nobody is looking at. But if
      // the user switched to it while the sweep was in flight, the visit-time
      // effect saw the id already claimed and did nothing, and won't run again
      // on its own: the tab sat on its loader with no error and no Retry. So
      // for the ACTIVE tab, raise the same error overlay the visit path does.
      // The tabs that did not load, for a caller that shows one (the side by side pane).
      const failures: string[] = [];
      const failed = (targetId: string) => {
        failures.push(targetId);
        fetching.delete(targetId);
        if (targetId !== activeIdRef.current) return;
        setTabLoadErrors((prev) => (prev.has(targetId) ? prev : new Set(prev).add(targetId)));
      };
      const wanted = tabsRef.current
        .map((t) => t.id)
        .filter((id) => !only || only.includes(id))
        .filter((id) => !loadedTabIds.has(id) && !isTabOutOfScope(id, sessionTabScope));
      // A tab another fetch is already loading is waited for, and reported as that fetch ends.
      const elsewhere = wanted.filter((id) => fetching.has(id));
      const pending = wanted.filter((id) => !fetching.has(id));
      pending.forEach((id) => fetching.add(id));
      const sweep = pending.map((targetId) => {
        const run = (async (): Promise<TabFetchEnd> => {
          try {
            const loaded = await apiLoadTabRevisioned(
              selfId,
              documentId,
              targetId,
              sessionShareCode,
            );
            if (!loaded) {
              // A 404 is anomalous here for the same reason as the visit-time
              // path above: the tab id came from the document summary, so a
              // missing row is a transient / auth edge, NOT proof the tab is
              // empty. Marking it loaded would arm the autosave to overwrite
              // the real row with an empty body (X-Allow-Empty). Drop the
              // optimistic id so the normal visit-time load (with its error
              // overlay) retries when the user actually opens the tab.
              failed(targetId);
              return 'failed';
            }
            if (adoptLoadedTab(loaded)) loadedTabIds.add(targetId);
            fetching.delete(targetId);
            setLoadedTabIds((prev) => (prev.has(targetId) ? prev : new Set(prev).add(targetId)));
            // A tab that failed on a visit and loads here is no longer failed: its overlay and a window's
            // "Couldn't load" both go.
            setTabLoadErrors((prev) => {
              if (!prev.has(targetId)) return prev;
              const next = new Set(prev);
              next.delete(targetId);
              return next;
            });
            return 'loaded';
          } catch {
            failed(targetId);
            return 'failed';
          }
        })();
        noteInFlight(targetId, run);
        return run;
      });
      // A fetch elsewhere that was cancelled (its visit moved on) may have been started again: wait on that one too,
      // a few times at most, then leave it to its own visit.
      const awaitElsewhere = async (id: string) => {
        for (let i = 0; i < TAB_FETCH_FOLLOW_MAX; i++) {
          const run = inFlightRef.current.get(id);
          if (!run) return;
          const end = await run;
          if (end === 'failed') failures.push(id);
          if (end !== 'cancelled') return;
        }
      };
      await Promise.all([...sweep, ...elsewhere.map(awaitElsewhere)]);
      return failures;
    },
    [
      hydrated,
      documentId,
      selfId,
      sessionShareCode,
      sessionTabScope,
      adoptLoadedTab,
      loadedTabIdsRef,
      setLoadedTabIds,
      setTabLoadErrors,
      tabsRef,
      activeIdRef,
      noteInFlight,
    ],
  );

  return { loadAllTabs };
}
