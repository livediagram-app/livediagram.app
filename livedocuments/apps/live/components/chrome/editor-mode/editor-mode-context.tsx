'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { EditorModeState } from '@/hooks/editor/useEditorMode';

// The editor's own resolved mode for the active tab (useEditorMode), Pages, the one mode
// (docs/specs/007-editor/pages-mode.md "One mode"), for the surfaces that read it, such as the
// palette's catalogue. One resolution, read by all, so a surface and the canvas cannot disagree.
// Null outside a provider (the Explorer page, /new, a test that mounts a panel alone).
const EditorModeContext = createContext<EditorModeState | null>(null);

export function EditorModeProvider({
  value,
  children,
}: {
  value: EditorModeState;
  children: ReactNode;
}) {
  return <EditorModeContext.Provider value={value}>{children}</EditorModeContext.Provider>;
}

export function useEditorModeState(): EditorModeState | null {
  return useContext(EditorModeContext);
}
