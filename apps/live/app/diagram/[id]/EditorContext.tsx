import { createContext, useContext } from 'react';
import type { useEditorState } from './useEditorState';

// Derived from the page's orchestration hook so the value type stays in
// lockstep with the provider + consumers, no hand-maintained field list.
export type EditorContextValue = ReturnType<typeof useEditorState>;

const EditorContext = createContext<EditorContextValue | null>(null);

export function useEditorContext(): EditorContextValue {
  const value = useContext(EditorContext);
  if (!value) throw new Error('useEditorContext must be used within an EditorContext.Provider');
  return value;
}

export { EditorContext };
