'use client';

// The layout gallery on its own (docs/specs/007-editor/pages-mode.md "An empty page offers its
// layouts"): what Choose a Layout opens on a page too small on screen for its card. A sheet risen
// from the bottom on a phone, a centred dialog on a desktop zoomed out; a press (or Surprise Me)
// places the layout and closes it, so the page is seen with it. Like the card it stands in for, it
// keeps to its layouts (no Change Theme). Headed by the dialog hero header
// (liveworkspace/docs/specs/004-index/dialog-hero-header.md), drawn as the gallery: frames tiled, one chosen.
import { pageDeviceClass, pageKindOf, type LaidOutPage } from '@livedesign/design';
import { layoutCatalogueFor, type PageLayoutId } from '@livedesign/templates';
import { HeroDialogHeader } from '@liveworkspace/ui/dialog-hero';
import { Dialog } from '@liveworkspace/workbench/components/dialogs/Dialog';
import { LayoutGallery } from './layout-gallery/LayoutGallery';
import { layoutGalleryHeroArt } from './LayoutGalleryHeroArt';

export function LayoutGalleryDialog({
  page,
  onApply,
  onClose,
}: {
  page: LaidOutPage;
  onApply: (layout: PageLayoutId) => void;
  onClose: () => void;
}) {
  const count = layoutCatalogueFor(pageKindOf(page), pageDeviceClass(page)).layouts.length;
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
      <HeroDialogHeader
        art={layoutGalleryHeroArt}
        titleId={titleId}
        title="Start From a Layout"
        subtitle={`${count} layouts in your theme. Pick one, then make it yours.`}
        onClose={onClose}
        underHandle
      />
      <div className="flex min-h-0 flex-col p-4" data-layout-gallery-dialog={page.id}>
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
