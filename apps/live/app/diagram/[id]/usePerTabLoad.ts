import {
  useCallback,
  useEffect,
  useRef,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from 'react';
import type { Tab } from '@livediagram/diagram';
import { apiLoadTab } from '@/lib/api-client';
import { track } from '@/lib/telemetry';

// Lazy per-tab content load (docs/specs/006-diagram/per-tab-storage.md), lifted out of editor-page.tsx.
// Hydration seeds the first tab; switching to a never-opened tab fires a
// one-shot GET that merges the elements into local state. Failures fall
// back to the placeholder so the editor doesn't lock up. The loaded-set
// ref + its reactive mirror are seeded by hydration and passed in, as is
// resetTabs (the history reset) and the remote-update guard ref.
//
// Also returns `loadAllTabs`, the search panel's prefetch (docs/specs/008-canvas/canvas-and-palette.md
// "Search panel"): element search walks local tab state, so unvisited
// placeholders would silently miss; opening search pulls every
// remaining tab's content in one parallel sweep.
// A tab the user has already drawn on (or picked a template for) keeps its
// local content over a late fetch.
function userHasEdited(t: Tab): boolean {
  return t.elements.length > 0 || t.templateChosen === true;
}

export function usePerTabLoad(opts: {
  hydrated: boolean;
  diagramId: string | null;
  activeId: string;
  selfId: string;
  sessionShareCode: string | null;
  // Latest tabs, mirrored to a ref by the page so loadAllTabs can
  // enumerate ids without re-creating itself on every tabs change.
  tabsRef: MutableRefObject<Tab[]>;
  loadedTabIdsRef: MutableRefObject<Set<string>>;
  setLoadedTabIds: Dispatch<SetStateAction<Set<string>>>;
  // Tabs whose lazy fetch FAILED (network / 5xx). Drives the canvas
  // error overlay so the user can't edit a blank placeholder and wipe
  // the real server row (docs/specs/006-diagram/per-tab-storage.md). Bumping `retryNonce` re-runs the
  // effect for the same active tab (the Retry button).
  setTabLoadErrors: Dispatch<SetStateAction<Set<string>>>;
  retryNonce: number;
  // The autosave's baseline. Content fetched from D1 is by definition saved,
  // so it lands here too, or the next save would PUT and broadcast the whole
  // tab back as if we had just drawn it (docs/specs/012-collaboration/collab-race-hardening.md).
  lastSavedTabsRef: MutableRefObject<Tab[]>;
  resetTabs: (updater: (prev: Tab[]) => Tab[]) => void;
}) {
  const {
    hydrated,
    diagramId,
    activeId,
    selfId,
    sessionShareCode,
    tabsRef,
    loadedTabIdsRef,
    setLoadedTabIds,
    setTabLoadErrors,
    retryNonce,
    lastSavedTabsRef,
    resetTabs,
  } = opts;

  // resetTabs is read through a ref, not listed as an effect dep. The load
  // effect must re-run only for a genuine reason (the tab, the diagram, the
  // identity, or the Retry nonce). When it listed resetTabs and the caller
  // passed a fresh function each render, every re-render (the 30s presence
  // tick among them) tore the effect down and refetched; on a tab whose load
  // had FAILED that meant a refetch, and an Error telemetry report, twice a
  // minute for as long as the tab stayed open (docs/specs/017-telemetry/telemetry.md).
  const resetTabsRef = useRef(resetTabs);
  useEffect(() => {
    resetTabsRef.current = resetTabs;
  });
  // Read by the search sweep when a fetch fails (see loadAllTabs).
  const activeIdRef = useRef(activeId);
  useEffect(() => {
    activeIdRef.current = activeId;
  });

  // Put a fetched tab in place: on screen, over a placeholder the user hasn't
  // touched (a tab they already drew on keeps its local content), and in the
  // autosave's baseline under the same rule, since content fetched from D1 is
  // by definition saved (docs/specs/012-collaboration/collab-race-hardening.md). Either way the local folder stays: it's
  // per-diagram link metadata (docs/specs/006-diagram/tab-folders.md) owned by the meta path, not the
  // content fetch. The baseline decision reads the last render (tabsRef), not
  // the state updater, which React may run late or twice.
  const adoptLoadedTab = (tab: Tab) => {
    const onScreen = tabsRef.current.find((t) => t.id === tab.id);
    if (onScreen && !userHasEdited(onScreen)) {
      lastSavedTabsRef.current = lastSavedTabsRef.current.map((t) =>
        t.id === tab.id ? { ...tab, folder: t.folder } : t,
      );
    }
    resetTabsRef.current((prev) =>
      prev.map((t) => (t.id !== tab.id || userHasEdited(t) ? t : { ...tab, folder: t.folder })),
    );
  };

  // The attempt that last failed, keyed on everything that makes a fetch
  // worth repeating. A failed load stays failed (the error overlay stays up)
  // until that key changes: Retry bumps the nonce, or the user moves to
  // another tab / diagram / identity. Belt and braces over the dep list, so
  // an unstable dep can never again turn a failure into a refetch loop.
  const failedAttemptRef = useRef<string | null>(null);

  useEffect(() => {
    if (!hydrated || !diagramId) return;
    const attemptKey = JSON.stringify([diagramId, activeId, selfId, sessionShareCode, retryNonce]);
    if (failedAttemptRef.current === attemptKey) return;
    // Any other key forgets the failure, even when this run then bails on an
    // already-loaded tab: switching away and back to the failed tab retries.
    failedAttemptRef.current = null;
    if (loadedTabIdsRef.current.has(activeId)) return;
    let cancelled = false;
    loadedTabIdsRef.current.add(activeId);
    // Track whether we actually consumed the API response. Cleanup
    // checks this flag — if the effect was torn down before it could
    // merge (StrictMode double-invoke, fast activeId switch, etc.),
    // we remove the id from the loaded-set so the next effect run
    // can retry instead of skipping forever. Without this, Tab 2
    // reliably loaded as empty: first effect added the id, then the
    // cleanup cancelled the in-flight fetch, then the second effect
    // saw the id in the set and bailed.
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
    apiLoadTab(selfId, diagramId, targetId, sessionShareCode)
      .then((tab) => {
        if (cancelled) return;
        if (!tab) {
          // A null result is a 404 — the tab ROW is missing. We used to
          // treat that as "genuinely empty", mark the tab loaded, and drop
          // the loader. That was a data-loss trap: a *legitimately* empty
          // tab returns 200 with `{ elements: [] }` (the row still
          // exists), and the tab we're loading is the active tab, which is
          // ALWAYS in the diagram summary we hydrated from. So a 404 here
          // is anomalous — a mis-routed / transient 404, a share-code /
          // auth edge, or a row deleted out from under a stale summary —
          // NOT proof the tab is empty. Marking it loaded-and-empty would
          // arm the autosave to overwrite the real row with `{ elements:
          // [] }`. Route it to the same blocking retry overlay as a 5xx so
          // a wrong 404 can never wipe content; merged stays false so the
          // cleanup drops the optimistic id and Retry refetches.
          loadedTabIds.delete(targetId);
          failedAttemptRef.current = attemptKey;
          setTabLoadErrors((prev) => (prev.has(targetId) ? prev : new Set(prev).add(targetId)));
          return;
        }
        clearError();
        // Telemetry (docs/specs/017-telemetry/telemetry.md): a tab's content was fetched because the
        // user switched to it. The first tab of each diagram is counted
        // at hydration (useIdentityBootstrap), and it's already in the
        // loaded-set here so this effect bails for it — no double count.
        // The search prefetch (loadAllTabs below) deliberately doesn't
        // emit: it's a background sweep, not a user viewing a tab.
        track('Tab', 'Loaded');
        adoptLoadedTab(tab);
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
      })
      .catch(() => {
        if (cancelled) return;
        // Network / 5xx. Drop the id from the loaded-set so a later tab
        // switch (or the Retry button via retryNonce) refetches, and
        // flag it so the canvas shows the blocking error overlay instead
        // of an editable blank canvas. Only those refetch: the attempt
        // key below stops a mere re-render from retrying.
        loadedTabIds.delete(targetId);
        failedAttemptRef.current = attemptKey;
        setTabLoadErrors((prev) => (prev.has(targetId) ? prev : new Set(prev).add(targetId)));
      });
    return () => {
      cancelled = true;
      // StrictMode double-invoke + cleanup-before-promise-resolve
      // used to lock the tab in "loaded but empty" state forever:
      // the first run added the id and was cancelled before the
      // response arrived; the second run saw the id in the set and
      // bailed; the user never saw the real content. Drop the id
      // here so the next run actually fetches.
      if (!merged) loadedTabIds.delete(targetId);
    };
    // Omitted deps are all refs + state setters (stable by React's guarantee);
    // resetTabs is read through resetTabsRef on purpose (see above).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, diagramId, activeId, selfId, sessionShareCode, retryNonce]);

  // One-shot parallel fetch of every not-yet-loaded tab, so element
  // search covers the whole diagram instead of just the tabs the user
  // happened to visit. Same merge semantics as the single-tab effect
  // above (skip user-edited tabs, keep the local folder, flag the
  // remote-update guard). Best-effort: a failed fetch just drops the
  // id back out of the loaded-set so the normal visit-time load (with
  // its error overlay) retries; search shouldn't surface blocking
  // errors for tabs the user isn't even looking at.
  const loadAllTabs = useCallback(async () => {
    if (!hydrated || !diagramId) return;
    const loadedTabIds = loadedTabIdsRef.current;
    // A failed sweep fetch is silent for a tab nobody is looking at. But if
    // the user switched to it while the sweep was in flight, the visit-time
    // effect saw the id already claimed and did nothing, and won't run again
    // on its own: the tab sat on its loader with no error and no Retry. So
    // for the ACTIVE tab, raise the same error overlay the visit path does.
    const failed = (targetId: string) => {
      loadedTabIds.delete(targetId);
      if (targetId !== activeIdRef.current) return;
      setTabLoadErrors((prev) => (prev.has(targetId) ? prev : new Set(prev).add(targetId)));
    };
    const pending = tabsRef.current.map((t) => t.id).filter((id) => !loadedTabIds.has(id));
    if (pending.length === 0) return;
    pending.forEach((id) => loadedTabIds.add(id));
    await Promise.all(
      pending.map(async (targetId) => {
        try {
          const tab = await apiLoadTab(selfId, diagramId, targetId, sessionShareCode);
          if (!tab) {
            // A 404 is anomalous here for the same reason as the visit-time
            // path above: the tab id came from the diagram summary, so a
            // missing row is a transient / auth edge, NOT proof the tab is
            // empty. Marking it loaded would arm the autosave to overwrite
            // the real row with an empty body (X-Allow-Empty). Drop the
            // optimistic id so the normal visit-time load (with its error
            // overlay) retries when the user actually opens the tab.
            failed(targetId);
            return;
          }
          adoptLoadedTab(tab);
          setLoadedTabIds((prev) => (prev.has(targetId) ? prev : new Set(prev).add(targetId)));
        } catch {
          failed(targetId);
        }
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, diagramId, selfId, sessionShareCode]);

  return { loadAllTabs };
}
