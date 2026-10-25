// Remembers the page the view rests on, per tab in this browser (lib/last-page,
// docs/specs/007-editor/pages-mode.md "Back to the page you were on"), so the frame on
// landing on a tab of pages can go back to it. Follows the viewport store without rendering: a
// pan or zoom only restarts a timer, and the page is worked out once the view has settled.
import { useCallback, useLayoutEffect, useRef, type RefObject } from 'react';
import type { LaidOutPage } from '@livedocuments/document';
import { computeViewportCenter } from '@/lib/viewport';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';
import type { View } from '@liveworkspace/workbench/lib/viewport-store';
import {
  LAST_PAGE_SETTLE_MS,
  pageNearestPoint,
  readLastPage,
  writeLastPage,
} from '@/lib/last-page';

type LastPage = {
  // The remembered page among these, if it is still one of them.
  remembered: (pages: readonly LaidOutPage[]) => LaidOutPage | undefined;
  // The tab's landing frame has been made: from now on the view is this tab's, so where it rests
  // is recorded (before it, the view may still be the last tab's).
  arm: () => void;
};

export function useLastPage(deps: {
  on: boolean;
  // lastPageKey for the active tab; absent records and recalls nothing.
  storeKey: string | undefined;
  pages: readonly LaidOutPage[];
  canvasMainRef: RefObject<HTMLElement | null>;
  viewport?: { get: () => View; subscribe: (listener: () => void) => () => void };
}): LastPage {
  const { on, storeKey, pages, canvasMainRef, viewport } = deps;
  const armedFor = useRef<string | null>(null);

  // A layout effect, so a tab switch records the last tab's page (its cleanup) before anything
  // frames the next tab.
  useLayoutEffect(() => {
    if (!on || !storeKey || !viewport || pages.length < 2) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const record = () => {
      timer = null;
      const canvas = canvasMainRef.current;
      if (armedFor.current !== storeKey || !canvas) return;
      const size = { width: canvas.offsetWidth, height: canvas.offsetHeight };
      const page = pageNearestPoint(pages, computeViewportCenter(size, viewport.get().offset));
      if (!page) return;
      writeLastPage(storeKey, page.id);
      debugLog('[page] last page recorded', { storeKey, page: page.id });
    };
    const settle = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(record, LAST_PAGE_SETTLE_MS);
    };
    // A reload straight after a move still keeps the page.
    const flush = () => {
      if (!timer) return;
      clearTimeout(timer);
      record();
    };
    const unsubscribe = viewport.subscribe(settle);
    window.addEventListener('pagehide', flush);
    return () => {
      unsubscribe();
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, [on, storeKey, pages, canvasMainRef, viewport]);

  const remembered = useCallback(
    (from: readonly LaidOutPage[]) => {
      const id = storeKey ? readLastPage(storeKey) : undefined;
      return id ? from.find((p) => p.id === id) : undefined;
    },
    [storeKey],
  );
  const arm = useCallback(() => {
    armedFor.current = storeKey ?? null;
  }, [storeKey]);
  return { remembered, arm };
}
