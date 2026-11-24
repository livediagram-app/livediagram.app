// What the Page Design panel is handed (docs/specs/011-theme/canvas-and-theme-dialog.md "Page Design"): the tab's
// design, the page someone is on and its own, what draws the previews, and the edits. The door (EditorModals) builds
// it into TabStylePages; the panel reads it there.
import type {
  DesignTheme,
  Element,
  LaidOutPage,
  PageDesign,
  PageDesignOverride,
} from '@livedocuments/document';
import type { PageDesignEdits } from '@/hooks/canvas/usePageDesignEdits';

export type PageDesignDoor = {
  tabDesign: PageDesign | undefined;
  // The page someone is on (laid out), with its own design; undefined on a tab with no pages.
  page: (LaidOutPage & { design?: PageDesignOverride }) | undefined;
  // The row, for the page's role and strip in its preview.
  pages: readonly LaidOutPage[];
  elements: Element[];
  theme: DesignTheme;
  tabFont: string | undefined;
  paperDark: boolean;
  edits: PageDesignEdits;
};
