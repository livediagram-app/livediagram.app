// Right-click context menu state, lifted out of useEditorState.
// Tracks the cursor position + the menu's mode (element-scoped vs
// tab-scoped) so the page can render a single ContextMenu portal that
// swaps its items based on what was clicked. Null = menu closed.

import { useState } from 'react';
import type { EditorContextMenuState } from '@/components/EditorContextMenu';

export function useEditorContextMenu() {
  const [contextMenu, setContextMenu] = useState<EditorContextMenuState | null>(null);
  const closeContextMenu = () => setContextMenu(null);
  return { contextMenu, setContextMenu, closeContextMenu };
}
