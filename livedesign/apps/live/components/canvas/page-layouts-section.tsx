'use client';

// The page panel's Layouts (docs/specs/007-editor/pages-mode.md "Layouts", "The layout gallery"):
// the page's catalogue (a wireframe page's screen layouts, a logo page's logo layouts) in the layout
// gallery. A press places the layout at once, over anything on the
// page (one undo step brings it back). Hovering a tile previews it on the page
// (PageLayoutPreview).
import type { LaidOutPage } from '@livedesign/design';
import type { PageLayoutId } from '@livedesign/templates';
import { LayoutGallery } from './layout-gallery/LayoutGallery';
import { PanelSection } from './page-panel-sections';

export function LayoutsSection(props: {
  page: LaidOutPage;
  onApply: (layout: PageLayoutId) => void;
  onPreview: (layout: PageLayoutId | null) => void;
}) {
  return (
    <PanelSection title="Start From a Layout">
      <LayoutGallery {...props} maxHeight="min(460px, 55vh)" />
    </PanelSection>
  );
}
