import { useEffect, useRef, type RefObject } from 'react';

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
//    time they add a shape. A tab entry that ARRIVES already positioned
//    (a Bring Focus jump, spec/144) names itself in `skipFitForTabRef`
//    and is left alone: the fit lands a frame after the jump's centring,
//    so without this it would quietly undo it.
export function useTabEntryEffects({
  hydrated,
  activeId,
  elementCount,
  fitToScreen,
  skipFitForTabRef,
}: {
  hydrated: boolean;
  activeId: string | null;
  // The active tab's element count: the fit re-arms when a lazy load
  // populates a tab that rendered empty on the previous frame.
  elementCount: number;
  fitToScreen: () => void;
  // A tab whose entry has already been positioned by its caller, so this
  // one must not fit it. Consumed (and cleared) on the entry it names.
  skipFitForTabRef?: RefObject<string | null>;
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
    if (skipFitForTabRef?.current && skipFitForTabRef.current === activeId) {
      // Already aimed somewhere deliberate. Claim the entry so a later
      // lazy load of this tab's elements doesn't re-arm the fit either.
      skipFitForTabRef.current = null;
      lastFittedTabRef.current = activeId;
      return;
    }
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
