import { useEffect, useRef } from 'react';

// The side effects of LANDING on a tab (hydration, a tab switch, or the
// active tab's elements finishing their lazy load), lifted out of
// useEditorState as one cohesive slice:
//
// 1. Pin the active tab into the URL fragment (#t=<tabId>) so a refresh
//    lands on the same tab. replaceState so switches don't pollute
//    history; skipped pre-hydration to avoid writing a placeholder id.
//    (The read side lives in seed-fetched-diagram.ts.)
// 2. Fit the viewport to the tab's content, once per tab entry. The
//    `lastFittedTabRef` gate means subsequent element edits on the same
//    tab DON'T re-fit, so the user's pan / zoom isn't resnapped every
//    time they add a shape.
export function useTabEntryEffects({
  hydrated,
  activeId,
  elementCount,
  fitToScreen,
}: {
  hydrated: boolean;
  activeId: string | null;
  // The active tab's element count: the fit re-arms when a lazy load
  // populates a tab that rendered empty on the previous frame.
  elementCount: number;
  fitToScreen: () => void;
}) {
  useEffect(() => {
    if (!hydrated || !activeId || typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    if (url.hash === `#t=${activeId}`) return;
    url.hash = `t=${activeId}`;
    window.history.replaceState({}, '', url.toString());
  }, [hydrated, activeId]);

  const lastFittedTabRef = useRef<string | null>(null);
  useEffect(() => {
    if (!hydrated) return;
    if (elementCount === 0) return;
    if (lastFittedTabRef.current === activeId) return;
    lastFittedTabRef.current = activeId;
    // Defer to the next frame so the canvas wrapper has its final
    // measured size before fitToScreen reads getBoundingClientRect.
    const handle = window.requestAnimationFrame(() => fitToScreen());
    return () => window.cancelAnimationFrame(handle);
    // fitToScreen reads live state via closure; we deliberately only
    // re-evaluate on hydration / tab-id / element-count transitions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, activeId, elementCount]);
}
