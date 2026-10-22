// What a page's tour steps drive (docs/specs/007-editor/pages-tour.md): the tour page, and its panel opened on a
// tab or closed. Shared by every track and by both ways a track runs: offered (PagesTourHost) and from the
// page's panel (Show Me, PageTour.tsx).
import type { PagePanelTab } from '@/components/canvas/PagePanel';
import type { TourStepOf } from './tour-step';

export type PageTourApi = {
  // The page the tour runs on.
  pageId: string;
  openPanel: (pageId: string, tab: PagePanelTab) => void;
  closePanel: () => void;
};

export type PageTourStep = TourStepOf<PageTourApi> & {
  // The control a step needs on screen when the tour starts, where its own anchor only appears once the step opens
  // it (a popover, the page's panel): the step is left out without it (spec "Filtering").
  requires?: (api: PageTourApi) => string;
};
