import { useCallback, useEffect, useEffectEvent, useRef, useState, type RefObject } from 'react';

// The side effects of LANDING on a tab (hydration, a tab switch, or the
// active tab's elements finishing their lazy load), lifted out of
// useEditorState as one cohesive slice:
//
// 1. Pin the active tab into the URL fragment (#t=<tabId>) so a refresh
//    lands on the same tab. replaceState so switches don't pollute
//    history; skipped pre-hydration to avoid writing a placeholder id.
//    (The read side lives in each editor's seed-fetched module.)
// 2. Fit the viewport to the tab's content, once per tab entry, as soon as
//    that content has loaded. The entry is claimed then even when the tab
//    is empty, so what the user adds afterwards, the first shape included,
//    never resnaps their pan / zoom. Replacing a tab's content wholesale
//    (a template, an import) asks for a fit through `requestFit`.
//    A tab entry that ARRIVES already positioned (a Bring Focus jump, a
//    changeset toast's Show) names itself in
//    `skipFitForTabRef` and is left alone: the fit lands a frame after the jump's centring,
//    so without this it would quietly undo it.
//    The warm open's tab (`warmTabId`, offline-mode.md "Warm open of a cloud document") is fitted as it paints, before
//    hydration, so a load that catches up with the same body never fits it a second time and the view does not jump.
//    A catch-up that replaced the body (`elements` is another array: the copy was older than the server's) fits it
//    again, so content the copy lacked is never left off screen.
// Each editor binds it once, at module scope in its `useTabEntryEffects.ts`, with its own editor addresses
// (lib/legacy-editor-path's `isEditorPath`) and, where it keeps one, the history entry's own state the pin must carry
// (liveplanner's open card mark, `historyState`; `{}` when left out).
export function createTabEntryEffects(
  isEditorPath: (pathname: string) => boolean,
  historyState: () => unknown = () => ({}),
) {
  return function useTabEntryEffects({
    hydrated,
    activeId,
    elementCount,
    tabLoaded,
    fitToScreen,
    skipFitForTabRef,
    warmTabId = null,
    elements,
  }: {
    hydrated: boolean;
    activeId: string | null;
    // The active tab's element count: an entry onto an empty tab claims it without fitting.
    elementCount: number;
    // The active tab's content is authoritative (hydrated, fetched, or created locally). Until it is,
    // an empty placeholder is not the tab's real content, so the entry waits.
    tabLoaded: boolean;
    fitToScreen: () => void;
    // A tab whose entry has already been positioned by its caller, so this
    // one must not fit it. Consumed (and cleared) on the entry it names.
    skipFitForTabRef?: RefObject<string | null>;
    // The tab the warm open painted from the last seen copy, before hydration; null when nothing was warm-painted.
    warmTabId?: string | null;
    // The active tab's elements array, by identity: the warm fit notes the one it fitted, and a catch-up that lands
    // another (a fresher body than the copy's) fits the tab again.
    elements?: unknown;
  }) {
    // fitToScreen reads live state; the fit is re-evaluated only on hydration / tab-id / load /
    // element-count transitions (and explicit requests), so it is called through an effect event.
    const fit = useEffectEvent(() => fitToScreen());
    useEffect(() => {
      if (!hydrated || !activeId || typeof window === 'undefined') return;
      const url = new URL(window.location.href);
      // An address that names no item (the new route's "Unknown addresses") has no tab to pin.
      if (!isEditorPath(url.pathname)) return;
      if (url.hash === `#t=${activeId}`) return;
      url.hash = `t=${activeId}`;
      window.history.replaceState(historyState(), '', url.toString());
    }, [hydrated, activeId]);

    const lastFittedTabRef = useRef<string | null>(null);
    // The warm-painted tab's fit and the body it fitted, until the catch-up has landed on it.
    const warmFitRef = useRef<{ tabId: string; elements: unknown } | null>(null);
    // Read, never a trigger: an edit made in the frame before the fit must not cancel it.
    const bodyNow = useEffectEvent(() => elements);
    useEffect(() => {
      // Before hydration only the warm-painted tab has a body to fit; every other tab waits for its load.
      if (!hydrated && warmTabId === null) return;
      const warm = warmFitRef.current;
      if (hydrated && warm && tabLoaded) {
        warmFitRef.current = null;
        // The catch-up replaced the painted body: the tab is entered afresh on what it now holds.
        if (warm.tabId === activeId && warm.elements !== bodyNow()) lastFittedTabRef.current = null;
      }
      if (skipFitForTabRef?.current && skipFitForTabRef.current === activeId) {
        // Already aimed somewhere deliberate. Claim the entry so a later
        // lazy load of this tab's elements doesn't re-arm the fit either.
        skipFitForTabRef.current = null;
        lastFittedTabRef.current = activeId;
        return;
      }
      if (lastFittedTabRef.current === activeId) return;
      if (!(hydrated ? tabLoaded : activeId === warmTabId)) return;
      lastFittedTabRef.current = activeId;
      if (!hydrated && activeId) warmFitRef.current = { tabId: activeId, elements: bodyNow() };
      if (elementCount === 0) return;
      // Defer to the next frame so the canvas wrapper has its final
      // measured size before fitToScreen reads getBoundingClientRect.
      const tabId = activeId;
      let fitted = false;
      const handle = window.requestAnimationFrame(() => {
        fitted = true;
        fit();
      });
      return () => {
        if (fitted) return;
        window.cancelAnimationFrame(handle);
        // A render before the frame (the element that lands with the load, the catch-up's next write) cancels the
        // fit, so the entry is not claimed yet: the rerun fits it on what the tab then holds.
        if (lastFittedTabRef.current === tabId) lastFittedTabRef.current = null;
      };
    }, [hydrated, activeId, tabLoaded, elementCount, skipFitForTabRef, warmTabId]);

    // A fit asked for alongside a content change. State, not a direct call, so the fit runs after the
    // render that carries the new content (the request batches with the commit that makes it).
    const [fitRequest, setFitRequest] = useState(0);
    useEffect(() => {
      if (fitRequest === 0) return;
      const handle = window.requestAnimationFrame(fit);
      return () => window.cancelAnimationFrame(handle);
    }, [fitRequest]);
    const requestFit = useCallback(() => setFitRequest((n) => n + 1), []);

    return { requestFit };
  };
}
