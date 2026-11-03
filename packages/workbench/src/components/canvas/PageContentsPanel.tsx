'use client';

// Contents as a popover (docs/specs/007-editor/pages-mode.md "Contents"): every page of the Pages
// tab, a live thumbnail each, the page in view marked; a press glides there. An Editor adds a page
// from its footer. A popover over its cluster button on a desktop (it stays open so a reader can
// hop from page to page, and its header docks it back as the sidebar), a bottom sheet on a phone
// (it closes so the page shows). Docked, Contents is PageContentsSidebar; the two share
// hooks/ui/usePageContents and PageContentsList. The editor hands in the popover's frame (its
// MovablePanel), its footer (Add Page) and its rows' own marks.
import { useEffect, useState, type ReactNode } from 'react';
import { lucidePanelLeftOpen } from '@liveworkspace/icons/lucide';
import { HoverCard, lucideGlyph, useEscape } from '@liveworkspace/ui';
import { BottomSheet } from '../primitives/BottomSheet';
import { useViewportStoreIfAny } from '../../hooks/canvas/useViewportStore';
import { pageInView, type ContentsPageRect, type ContentsRowBase } from '../../lib/page-contents';
import {
  ContentsFind,
  ContentsList,
  type ContentsBadges,
  type ContentsListState,
} from './PageContentsList';

const DockIcon = lucideGlyph(lucidePanelLeftOpen, 14);

/** The page in view as the popover opens: the one at the middle of the screen, else the nearest.
 *  Read once, on opening. */
export function usePageInViewOnOpen(pages: readonly ContentsPageRect[]): string | undefined {
  const viewport = useViewportStoreIfAny();
  const [here] = useState(() =>
    viewport
      ? pageInView(pages, viewport.get(), {
          width: window.innerWidth,
          height: window.innerHeight,
        })
      : pages[0]?.id,
  );
  return here;
}

export function ContentsPanel<R extends ContentsRowBase>({
  contents,
  mobile,
  onClose,
  onDock,
  footer,
  badges,
  frame,
}: {
  contents: ContentsListState<R>;
  // A phone's bottom sheet, not the popover.
  mobile: boolean;
  onClose: () => void;
  // Docks Contents as the sidebar again (a desktop's; a phone has no sidebar).
  onDock?: (() => void) | undefined;
  // The list's foot: the editor's Add Page.
  footer: ReactNode;
  badges?: ContentsBadges<R> | undefined;
  // The desktop popover round the list (the editor's MovablePanel, titled Contents, over its
  // cluster button), its header carrying `headerActions`.
  frame: (body: ReactNode, headerActions: ReactNode) => ReactNode;
}) {
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
    <div
      className="flex min-h-0 flex-col"
      data-page-contents=""
      // Presses, holds and right-clicks here are the list's, never the canvas's beneath the portal
      // (no canvas menu from a finger held on a row), as the sidebar's own are.
      onPointerDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.stopPropagation()}
    >
      <ContentsFind contents={contents} />
      <ContentsList
        contents={contents}
        variant="list"
        touch={mobile}
        badges={badges}
        className="gap-0.5 px-2 pb-2"
        style={{ maxHeight: mobile ? '55vh' : 'min(calc(100vh - 360px), 480px)' }}
      />
      {footer}
    </div>
  );

  if (mobile) return <ContentsSheet onClose={onClose}>{body}</ContentsSheet>;
  return frame(
    body,
    onDock ? (
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
    ) : null,
  );
}

// On a phone: the list in a bottom sheet, named, closed by a swipe down, an outside press or Escape.
function ContentsSheet({ onClose, children }: { onClose: () => void; children: ReactNode }) {
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
