'use client';

// The page tree in the canvas chrome (docs/specs/030-knowledgebase/blueprints/page-tree.md "The sidebar"): docked as
// the sidebar down the canvas's left on a desktop, joined to the menu box above it, or collapsed to its rail; on a
// phone, a Pages button that opens the same tree in a sheet. It stands where the fork's Contents sidebar stood, so
// the chrome's geometry (the corner stacks, the bottom-right cluster, the strip, the page framing) clears it the
// same way, at this sidebar's own width.
import { useCallback, useContext, useState, useSyncExternalStore, type ReactNode } from 'react';
import { useUiScale } from '@liveworkspace/workbench/components/providers/ui-scale';
import { EditorChromeContext } from '@/app/document/[id]/EditorContext';
import { toolbarTopClearancePx } from '@/lib/canvas-chrome';
import { readTreeCollapsed, writeTreeCollapsed } from '@/lib/page-tree-open';
import { track } from '@/lib/telemetry';
import { TOP_ROW_HEIGHT_PX } from '@/lib/page-surface/top-row-slot';
import { PageTreeSheet } from './PageTreeSheet';
import { PageTreeSidebar } from './PageTreeSidebar';
import { PAGE_TREE_RAIL_WIDTH, PAGE_TREE_WIDTH } from './page-tree-view';
import { usePageTreeModel } from './usePageTreeModel';
import { KnowledgebaseMenu } from '@/components/knowledge-menu/KnowledgebaseMenu';
import { usePageTrashSync } from '@/components/page-trash/usePageTrash';
import { PageTrashHost } from '@/components/page-trash/PageTrashDialog';
import { useLabelFilterReveal } from '@/components/page-labels/useLabelFilter';

const noSubscribe = () => () => {};

function PageTreeSidebarHost(props: {
  collapsed: boolean;
  onSetCollapsed: (collapsed: boolean) => void;
  top: number;
  joined: boolean;
}) {
  const { connectDialog, ...model } = usePageTreeModel();
  // The knowledgebase's page Trash (knowledgebases-and-pages.md "The page Trash"): its row in the tree, its dialog.
  const trash = usePageTrashSync();
  return (
    <>
      <PageTreeSidebar
        {...model}
        {...props}
        trash={trash.see}
        menu={(head) => <KnowledgebaseMenu name={head.name} onRename={head.onRename} />}
      />
      {connectDialog}
      <PageTrashHost rights={trash} />
    </>
  );
}

function PageTreeSheetHost() {
  const { connectDialog, ...model } = usePageTreeModel();
  const trash = usePageTrashSync();
  return (
    <>
      <PageTreeSheet
        {...model}
        trash={trash.see}
        menu={(head) => (
          <KnowledgebaseMenu
            touch
            name={head.name}
            onRename={head.onRename}
            // Every row but Rename opens something over the page: the sheet steps aside for it.
            onChosen={(verb) => {
              if (verb !== 'rename') head.close();
            }}
          />
        )}
      />
      {connectDialog}
      <PageTrashHost rights={trash} />
    </>
  );
}

export type PageTreeChrome = {
  // The sidebar (or its rail) is on screen down the left: the left corners and the cluster make room.
  docked: boolean;
  // The menu box heads the sidebar as its top row; never the rail, which stands under it.
  menuJoined: boolean;
  // The sidebar's width on screen now, at the panels' UI scale: the rail's when collapsed.
  width: number;
  sidebarEl: ReactNode;
  // A phone's Pages button, for the top row.
  phoneButton: ReactNode;
};

export function usePageTreeChrome({
  chromeHidden,
  zenMode,
  isMobile,
}: {
  chromeHidden: boolean;
  zenMode: boolean;
  isMobile: boolean;
}): PageTreeChrome {
  const toolbarScale = useUiScale('toolbar');
  // Rendered on its own (a test, a workbench preview) the chrome has no editor store, and so no tree.
  const store = useContext(EditorChromeContext);
  const embed = useSyncExternalStore(
    store?.subscribe ?? noSubscribe,
    () => store?.get().embedMode ?? false,
    () => false,
  );
  const [collapsed, setCollapsedState] = useState(readTreeCollapsed);
  const setCollapsed = useCallback((next: boolean) => {
    // Sent before the change is kept, as every settings flip is.
    track('UI', 'Changed', next ? 'PageTreeCollapsed' : 'PageTreeExpanded');
    writeTreeCollapsed(next);
    setCollapsedState(next);
  }, []);
  // A page's label pill pressed while the tree is folded to its rail: it opens on the filtered tree.
  useLabelFilterReveal(() => {
    if (collapsed) setCollapsed(false);
  });
  const shown = store !== null && !chromeHidden && !zenMode && !embed;
  const docked = shown && !isMobile;
  // Open, it rises to the canvas's top with the menu box as its first row; its rail stands under the top row.
  const top = collapsed ? TOP_ROW_HEIGHT_PX : toolbarTopClearancePx(toolbarScale);
  return {
    docked,
    menuJoined: docked && !collapsed,
    width: collapsed ? PAGE_TREE_RAIL_WIDTH : PAGE_TREE_WIDTH,
    sidebarEl: docked ? (
      <PageTreeSidebarHost
        collapsed={collapsed}
        onSetCollapsed={setCollapsed}
        top={top}
        joined={!collapsed}
      />
    ) : null,
    phoneButton: shown && isMobile ? <PageTreeSheetHost /> : null,
  };
}
