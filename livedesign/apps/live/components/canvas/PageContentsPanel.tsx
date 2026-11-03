'use client';

// Contents as a popover (docs/specs/007-editor/pages-mode.md "Contents"), a bottom sheet on a phone:
// the shared popover (@liveworkspace/workbench/components/canvas/PageContentsPanel) in this editor's
// MovablePanel and its Add Page. Docked, Contents is PageContentsSidebar.
import type { DockAnchor } from '@/lib/canvas-chrome';
import { MovablePanel } from '@/components/primitives/MovablePanel';
import { useIsMobileViewport } from '@liveworkspace/workbench/hooks/ui/useIsMobileViewport';
import {
  ContentsPanel,
  usePageInViewOnOpen,
} from '@liveworkspace/workbench/components/canvas/PageContentsPanel';
import type { PageThumbTab } from '@/hooks/ui/usePageThumbnails';
import type { PagesModeView } from '@/hooks/editor/usePagesMode';
import { usePageContents } from '@/hooks/ui/usePageContents';
import { ContentsAddPage } from './ContentsAddPage';

export function PageContentsPanel({
  view,
  tab,
  anchor,
  onClose,
  onDock,
}: {
  view: PagesModeView;
  tab: PageThumbTab;
  anchor?: DockAnchor;
  onClose: () => void;
  // Docks Contents as the sidebar again (a desktop's; a phone has no sidebar).
  onDock?: () => void;
}) {
  const mobile = useIsMobileViewport();
  const here = usePageInViewOnOpen(view.pages);
  const contents = usePageContents({
    view,
    tab,
    here,
    ...(mobile ? { onWent: onClose } : {}),
  });
  return (
    <ContentsPanel
      contents={contents}
      mobile={mobile}
      onClose={onClose}
      onDock={onDock}
      footer={<ContentsAddPage contents={contents} />}
      frame={(body, headerActions) => (
        <MovablePanel
          title="Contents"
          position={null}
          defaultCorner="bottom-right"
          onMoveTo={NO_MOVE}
          popoverOpen
          popoverAnchor={anchor}
          asPopover
          popoverWidth="w-[380px]"
          dismissOnOutside
          onPopoverClose={onClose}
          headerActions={headerActions}
        >
          {body}
        </MovablePanel>
      )}
    />
  );
}

const NO_MOVE = () => {};
