'use client';

// Contents (docs/specs/007-editor/pages-mode.md "Contents"): every page of the Pages
// tab, a live thumbnail each, the page in view marked; a press glides there. An Editor adds a page
// from its footer. A popover over its cluster button on a desktop (it stays open so a reader can
// hop from page to page, and its header docks it back as the sidebar), a bottom sheet on a phone
// (it closes so the page shows). Docked, Contents is PageContentsSidebar; the two share
// usePageContents and PageContentsList.
import { useEffect, useState } from 'react';
import { lucidePanelLeftOpen } from '@livepages/icons/lucide';
import { HoverCard, lucideGlyph, useEscape } from '@livepages/ui';
import type { DockAnchor } from '@/lib/canvas-chrome';
import { MovablePanel } from '@/components/primitives/MovablePanel';
import { BottomSheet } from '@/components/primitives/BottomSheet';
import { useIsMobileViewport } from '@/hooks/ui/useIsMobileViewport';
import type { PageThumbTab } from '@/hooks/ui/usePageThumbnails';
import type { PagesModeView } from '@/hooks/editor/usePagesMode';
import { usePageContents } from '@/hooks/ui/usePageContents';
import { pageInView } from '@/lib/page-contents';
import { useViewportStoreIfAny } from '@/hooks/canvas/useViewportStore';
import { ContentsAddPage } from './ContentsAddPage';
import { ContentsFind, ContentsList } from './PageContentsList';

const DockIcon = lucideGlyph(lucidePanelLeftOpen, 14);

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
  // The page in view as it opens: the one at the middle of the screen, else the nearest.
  const viewport = useViewportStoreIfAny();
  const [here] = useState(() =>
    viewport
      ? pageInView(view.pages, viewport.get(), {
          width: window.innerWidth,
          height: window.innerHeight,
        })
      : view.pages[0]?.id,
  );
  const contents = usePageContents({
    view,
    tab,
    here,
    ...(mobile ? { onWent: onClose } : {}),
  });

  // Escape closes the popover (the Find box clears itself first, stopping the key there).
  useEffect(() => {
    if (mobile) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobile, onClose]);

  const body = (
    <div className="flex min-h-0 flex-col" data-page-contents="">
      <ContentsFind contents={contents} />
      <ContentsList
        contents={contents}
        variant="list"
        touch={mobile}
        className="gap-0.5 px-2 pb-2"
        style={{ maxHeight: mobile ? '55vh' : 'min(calc(100vh - 360px), 480px)' }}
      />
      <ContentsAddPage contents={contents} />
    </div>
  );

  if (mobile) return <ContentsSheet onClose={onClose}>{body}</ContentsSheet>;
  return (
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
      headerActions={
        <>
          {onDock ? (
            <HoverCard title="Dock as Sidebar" description="Keep Contents open beside the canvas.">
              <button
                type="button"
                onClick={onDock}
                aria-label="Dock Contents as a sidebar"
                data-contents-dock=""
                className="relative flex h-6 w-6 touch-target items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-2 focus-visible:outline-brand-600 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
              >
                <DockIcon />
              </button>
            </HoverCard>
          ) : null}
        </>
      }
    >
      {body}
    </MovablePanel>
  );
}

const NO_MOVE = () => {};

// On a phone: the list in a bottom sheet, named, closed by a swipe down, an outside press or Escape.
function ContentsSheet({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  useEscape(onClose, { capture: true, stopPropagation: true });
  return (
    <BottomSheet
      role="dialog"
      aria-label="Contents"
      onClose={onClose}
      zClassName="z-[var(--z-overlay)]"
    >
      <div className="flex items-center justify-between px-4 pb-2 pt-0.5">
        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Contents</p>
      </div>
      {children}
    </BottomSheet>
  );
}
