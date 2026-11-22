'use client';

import { useContext, useSyncExternalStore } from 'react';
import { EditorChromeContext } from '@/app/document/[id]/EditorContext';

const noSubscribe = () => () => {};

/** Whether the page's top row is drawn (docs/specs/030-knowledgebase/page-surface.md "The footer"): in the app's own
 *  chrome, never in an embed or a workbench frame. Rendered on its own (a test, a preview) the chrome has no editor
 *  store: the row shows there when `alone` says so. */
export function useTopRowShown(alone: boolean): boolean {
  const store = useContext(EditorChromeContext);
  const shown = useSyncExternalStore(
    store?.subscribe ?? noSubscribe,
    () => {
      const s = store?.get();
      return s ? s.appChrome && !s.embedMode : null;
    },
    () => null,
  );
  return shown ?? alone;
}
