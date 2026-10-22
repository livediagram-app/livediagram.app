'use client';

// The page panel's Layouts (docs/specs/007-editor/pages-mode.md "Layouts", "The layout gallery"):
// the page's catalogue (a slide page's slide layouts, a logo page's logo layouts, else the
// infographic ones) in the layout gallery. A press places the layout at once, over anything on the
// page (one undo step brings it back). Hovering a tile previews it on the page
// (InfographicLayoutPreview).
import type { LaidOutPage } from '@livedesign/document';
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
