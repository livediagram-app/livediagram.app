import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

// The side effects of LANDING on a tab (hydration, a tab switch, or the
// active tab's elements finishing their lazy load), lifted out of
// useEditorState as one cohesive slice:
//
// 1. Pin the active tab into the URL fragment (#t=<tabId>) so a refresh
//    lands on the same tab. replaceState so switches don't pollute
//    history; skipped pre-hydration to avoid writing a placeholder id.
//    (The read side lives in seed-fetched-diagram.ts.)
// 2. Fit the viewport to the tab's content, once per tab entry, as soon as
//    that content has loaded. The entry is claimed then even when the tab
//    is empty, so what the user adds afterwards, the first shape included,
//    never resnaps their pan / zoom. Replacing a tab's content wholesale
//    (a template, an import) asks for a fit through `requestFit`.
//    A tab entry that ARRIVES already positioned (a Bring Focus jump,
//    docs/specs/012-collaboration/bring-focus.md) names itself in
//    `skipFitForTabRef` and is left alone: the fit lands a frame after the jump's centring,
//    so without this it would quietly undo it.
export function useTabEntryEffects({
  hydrated,
  activeId,
  elementCount,
  tabLoaded,
  fitToScreen,
  skipFitForTabRef,
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
    if (lastFittedTabRef.current === activeId) return;
    if (!tabLoaded) return;
    lastFittedTabRef.current = activeId;
    if (elementCount === 0) return;
    // Defer to the next frame so the canvas wrapper has its final
    // measured size before fitToScreen reads getBoundingClientRect.
    const handle = window.requestAnimationFrame(() => fitToScreen());
    return () => window.cancelAnimationFrame(handle);
    // fitToScreen reads live state via closure; we deliberately only
    // re-evaluate on hydration / tab-id / load / element-count transitions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, activeId, tabLoaded, elementCount]);

  // A fit asked for alongside a content change. State, not a direct call, so the fit runs after the
  // render that carries the new content (the request batches with the commit that makes it).
  const [fitRequest, setFitRequest] = useState(0);
  useEffect(() => {
    if (fitRequest === 0) return;
    const handle = window.requestAnimationFrame(() => fitToScreen());
    return () => window.cancelAnimationFrame(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitRequest]);
  const requestFit = useCallback(() => setFitRequest((n) => n + 1), []);

  return { requestFit };
}
