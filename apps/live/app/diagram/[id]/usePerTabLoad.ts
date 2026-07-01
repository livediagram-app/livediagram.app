import {
  useCallback,
  useEffect,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from 'react';
import type { Tab } from '@livediagram/diagram';
import { apiLoadTab } from '@/lib/api-client';
import { track } from '@/lib/telemetry';

// Lazy per-tab content load (spec/13), lifted out of editor-page.tsx.
// Hydration seeds the first tab; switching to a never-opened tab fires a
// one-shot GET that merges the elements into local state. Failures fall
// back to the placeholder so the editor doesn't lock up. The loaded-set
// ref + its reactive mirror are seeded by hydration and passed in, as is
// resetTabs (the history reset) and the remote-update guard ref.
//
// Also returns `loadAllTabs`, the search panel's prefetch (spec/09
// "Search panel"): element search walks local tab state, so unvisited
// placeholders would silently miss; opening search pulls every
// remaining tab's content in one parallel sweep.
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
  // the real server row (spec/13). Bumping `retryNonce` re-runs the
  // effect for the same active tab (the Retry button).
  setTabLoadErrors: Dispatch<SetStateAction<Set<string>>>;
  retryNonce: number;
  remoteUpdateRef: MutableRefObject<boolean>;
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
    remoteUpdateRef,
    resetTabs,
  } = opts;

  useEffect(() => {
    if (!hydrated || !diagramId) return;
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
          setTabLoadErrors((prev) => (prev.has(targetId) ? prev : new Set(prev).add(targetId)));
          return;
        }
        clearError();
        // Telemetry (spec/22): a tab's content was fetched because the
        // user switched to it. The first tab of each diagram is counted
        // at hydration (useIdentityBootstrap), and it's already in the
        // loaded-set here so this effect bails for it — no double count.
        // The search prefetch (loadAllTabs below) deliberately doesn't
        // emit: it's a background sweep, not a user viewing a tab.
        track('Tab', 'Loaded');
        let didMerge = false;
        resetTabs((prev) =>
          prev.map((t) => {
            if (t.id !== tab.id) return t;
            const userHasEdited = t.elements.length > 0 || t.templateChosen === true;
            if (userHasEdited) return t;
            didMerge = true;
            // Keep the local folder: it's per-diagram link metadata
            // (spec/30) owned by the meta path, not the content fetch,
            // so a content load must never overwrite a folder the user
            // just set on this not-yet-opened tab.
            return { ...tab, folder: t.folder };
          }),
        );
        if (didMerge) remoteUpdateRef.current = true;
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
        // of an editable blank canvas.
        loadedTabIds.delete(targetId);
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
    // Omitted deps are all refs + state setters (stable by React's guarantee).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, diagramId, activeId, selfId, sessionShareCode, retryNonce, resetTabs]);

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
    const pending = tabsRef.current.map((t) => t.id).filter((id) => !loadedTabIds.has(id));
    if (pending.length === 0) return;
    pending.forEach((id) => loadedTabIds.add(id));
    await Promise.all(
      pending.map(async (targetId) => {
        try {
          const tab = await apiLoadTab(selfId, diagramId, targetId, sessionShareCode);
          if (tab) {
            let didMerge = false;
            resetTabs((prev) =>
              prev.map((t) => {
                if (t.id !== tab.id) return t;
                const userHasEdited = t.elements.length > 0 || t.templateChosen === true;
                if (userHasEdited) return t;
                didMerge = true;
                return { ...tab, folder: t.folder };
              }),
            );
            if (didMerge) remoteUpdateRef.current = true;
          }
          // 404s count as loaded too, same as the visit-time path: the
          // tab genuinely has no server content.
          setLoadedTabIds((prev) => (prev.has(targetId) ? prev : new Set(prev).add(targetId)));
        } catch {
          loadedTabIds.delete(targetId);
        }
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, diagramId, selfId, sessionShareCode, resetTabs]);

  return { loadAllTabs };
}
