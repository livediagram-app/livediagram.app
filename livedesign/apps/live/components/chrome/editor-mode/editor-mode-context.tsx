'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { EditorModeState } from '@/hooks/editor/useEditorMode';

// The editor's own resolved mode for the active tab (useEditorMode), for the surfaces that carry
// the mode switch: the Toolbar layout's menu button and the Floating layout's Explorer panel
// (docs/specs/007-editor/editor-modes.md "The mode switch"). One resolution, read by all, so
// a switch and the canvas cannot disagree. Null outside a provider (the Explorer page, /new, a
// test that mounts a panel alone), where no switch renders.
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
