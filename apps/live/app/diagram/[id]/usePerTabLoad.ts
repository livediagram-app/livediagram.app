import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import type { Tab } from '@livediagram/diagram';
import { apiLoadTab } from '@/lib/api-client';

// Lazy per-tab content load (spec/13), lifted out of editor-page.tsx.
// Hydration seeds the first tab; switching to a never-opened tab fires a
// one-shot GET that merges the elements into local state. Failures fall
// back to the placeholder so the editor doesn't lock up. The loaded-set
// ref + its reactive mirror are seeded by hydration and passed in, as is
// resetTabs (the history reset) and the remote-update guard ref.
export function usePerTabLoad(opts: {
  hydrated: boolean;
  diagramId: string | null;
  activeId: string;
  selfId: string;
  sessionShareCode: string | null;
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
          // 404: the tab genuinely has no server content (e.g. deleted
          // between the summary fetch and now). Not a failure — mark it
          // loaded so the canvas drops its loader and shows the empty /
          // template-picker state instead of spinning forever.
          merged = true;
          loadedTabIds.add(targetId);
          setLoadedTabIds((prev) => (prev.has(targetId) ? prev : new Set(prev).add(targetId)));
          clearError();
          return;
        }
        clearError();
        let didMerge = false;
        resetTabs((prev) =>
          prev.map((t) => {
            if (t.id !== tab.id) return t;
            const userHasEdited = t.elements.length > 0 || t.templateChosen === true;
            if (userHasEdited) return t;
            didMerge = true;
            return tab;
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
  }, [hydrated, diagramId, activeId, selfId, sessionShareCode, retryNonce, resetTabs]);
}
