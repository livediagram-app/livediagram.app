'use client';

import { createContext, useContext } from 'react';

// The editor page's context: each editor makes it once, at module scope in its EditorContext.tsx, typed from its
// page's orchestration hook (`ReturnType<typeof useEditorState>`), so the value type stays in lockstep with the
// provider and consumers, no hand-maintained field list.
export function createEditorContext<EditorContextValue>() {
  const EditorContext = createContext<EditorContextValue | null>(null);

  function useEditorContext(): EditorContextValue {
    const value = useContext(EditorContext);
    if (!value) throw new Error('useEditorContext must be used within an EditorContext.Provider');
    return value;
  }

  /** The editor around this component, or null outside one (a surface mounted on its own). */
  function useOptionalEditorContext(): EditorContextValue | null {
    return useContext(EditorContext);
  }

  return { EditorContext, useEditorContext, useOptionalEditorContext };
}
