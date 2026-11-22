'use client';

// The open knowledgebase's style, for anything drawn inside the editor's chrome store (the writing, the element
// layer, the dialog): the knowledgebase's id read as one slice, then the style from its store, so a keystroke or a
// scroll renders nothing here. Rendered on its own (a test, a preview) there is no knowledgebase, and the default
// style stands.
import { useContext, useSyncExternalStore } from 'react';
import type { KnowledgeStyle } from '@liveknowledge/document';
import { EditorChromeContext } from '@/app/document/[id]/EditorContext';
import { useKnowledgeStyle } from '@/lib/knowledge-style/knowledge-style-store';

const noSubscribe = () => () => {};

export function useOpenKnowledgeId(): string | null {
  const store = useContext(EditorChromeContext);
  return useSyncExternalStore(
    store?.subscribe ?? noSubscribe,
    () => store?.get().documentId ?? null,
    () => null,
  );
}

export function useOpenKnowledgeStyle(): KnowledgeStyle {
  return useKnowledgeStyle(useOpenKnowledgeId());
}
