'use client';

// Whether this session is offered Knowledgebase Style (lib/knowledge-style/style-offered.ts): one boolean read from
// the editor's chrome store, so a keystroke renders nothing here until it changes.
import { useContext, useSyncExternalStore } from 'react';
import { EditorChromeContext } from '@/app/document/[id]/EditorContext';
import { styleOfferedOf } from '@/lib/knowledge-style/style-offered';

const noSubscribe = () => () => {};

export function useStyleOffered(): boolean {
  // Rendered on its own (a test, a workbench preview) the chrome has no editor store, and so no knowledgebase.
  const store = useContext(EditorChromeContext);
  return useSyncExternalStore(
    store?.subscribe ?? noSubscribe,
    () => (store ? styleOfferedOf(store.get()) : false),
    () => false,
  );
}
