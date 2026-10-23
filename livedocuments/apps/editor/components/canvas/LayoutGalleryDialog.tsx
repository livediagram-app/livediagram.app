'use client';

// The layout gallery on its own (docs/specs/007-editor/pages-mode.md "An empty page offers its
// layouts"): what Choose a Layout opens on a page too small on screen for its card. A sheet risen
// from the bottom on a phone, a centred dialog on a desktop zoomed out; a press (or Surprise Me)
// places the layout and closes it, so the page is seen with it. Like the card it stands in for, it
// keeps to its layouts (no Change Theme).
import { pageKindOf, type LaidOutPage } from '@livedocuments/document';
import { layoutCatalogueFor, type PageLayoutId } from '@livedocuments/templates';
import { CloseIcon, Tooltip } from '@livedocuments/ui';
import { Dialog } from '@/components/dialogs/Dialog';
import { LayoutGallery } from './layout-gallery/LayoutGallery';

export function LayoutGalleryDialog({
  page,
  onApply,
  onClose,
}: {
  page: LaidOutPage;
  onApply: (layout: PageLayoutId) => void;
  onClose: () => void;
}) {
  const count = layoutCatalogueFor(pageKindOf(page)).layouts.length;
  const titleId = `layout-gallery-${page.id}`;
  return (
    <Dialog
      open
      onClose={onClose}
      titleId={titleId}
      size="3xl"
      phoneSheet
      // The gallery is where anyone starts: no control takes focus (and shows its tooltip) on open.
      initialFocus="container"
    >
      <div className="flex min-h-0 flex-col p-4" data-layout-gallery-dialog={page.id}>
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id={titleId} className="text-base font-semibold text-slate-900 dark:text-slate-50">
              Start From a Layout
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {count} layouts in your theme. Pick one, then make it yours.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Tooltip label="Close">
              <button
                type="button"
                aria-label="Close"
                onClick={onClose}
                className="touch-target relative flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-brand-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              >
                <CloseIcon />
              </button>
            </Tooltip>
          </div>
        </div>
        <LayoutGallery
          page={page}
          onApply={(layout) => {
            onApply(layout);
            onClose();
          }}
          onPreview={() => {}}
          described
          maxHeight="min(560px, calc(85dvh - 170px))"
        />
      </div>
    </Dialog>
  );
}
