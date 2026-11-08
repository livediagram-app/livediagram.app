'use client';

import { useMemo, type ReactNode, type SetStateAction } from 'react';
import { SelectionStoreProvider } from '@liveworkspace/workbench/hooks/canvas/useSelectionStore';
import { EditorContext, useEditorContext } from './EditorContext';
import { replayStore, useReplayState } from '@/lib/replay/replay-store';
import type { EditorContextMenuState } from '@/components/palette/EditorContextMenu.types';

const setReplayMenu = (next: SetStateAction<EditorContextMenuState | null>) =>
  replayStore.set({ menu: typeof next === 'function' ? next(replayStore.get().menu) : next });
const closeReplayMenu = () => replayStore.set({ menu: null });

// While Watch It Built runs (docs/specs/007-editor/blueprints/watch-it-built.md "The scope"), the canvas and the
// element menu see the demo drawn in: the active tab's elements with the demo's after them, the replay's held menu and
// the replay's own selection. Nothing else in the editor sees any of it, so it is never saved, sent or undone.
export function ReplayScope({ children }: { children: ReactNode }) {
  const ctx = useEditorContext();
  const replay = useReplayState();
  const value = useMemo(() => {
    if (!replay.active) return null;
    return {
      ...ctx,
      activeTab: { ...ctx.activeTab, elements: [...ctx.activeTab.elements, ...replay.elements] },
      contextMenu: replay.menu,
      setContextMenu: setReplayMenu,
      closeContextMenu: closeReplayMenu,
      selectionStore: replayStore.selection,
    };
  }, [ctx, replay]);
  if (!value) return <>{children}</>;
  return (
    <EditorContext.Provider value={value}>
      <SelectionStoreProvider store={replayStore.selection}>{children}</SelectionStoreProvider>
    </EditorContext.Provider>
  );
}
