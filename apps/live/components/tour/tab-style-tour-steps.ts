// The steps of Show Me in the Tab Style dialog (docs/specs/011-theme/canvas-and-theme-dialog.md "Show Me"): a tour of
// the dialog's home, run on the dialog itself. Each step brings the home forward (a panel may be open) and scrolls
// its control into view; the control stays usable, so the person can pick a look or open a panel while it is up.
import type { TourStepOf } from './tour-step';
import { revealTour } from './tour-dom';

export type TabStyleTourApi = {
  // Brings the home (the looks and the Fine-tune rows) forward.
  showHome: () => void;
};

type TabStyleTourStep = TourStepOf<TabStyleTourApi>;

const step = (id: string, title: string, body: string, target: string): TabStyleTourStep => ({
  id,
  title,
  body,
  target,
  prepare: async (api) => {
    api.showHome();
    await revealTour(target);
  },
});

const LOOKS = step(
  'looks',
  'One-Click Looks',
  'Each look sets the tab’s colours, finish, font and canvas at once. One undo step.',
  'tab-style-looks',
);

const PAGES = step(
  'pages',
  'More Looks',
  'Use the arrows or the dots, or swipe, for the next page of looks.',
  'tab-style-looks-nav',
);

const FINE_TUNE = step(
  'fine-tune',
  'Fine-Tune Any Part',
  'Each row shows what the tab uses now. Open one to change just that.',
  'tab-style-fine-tune',
);

const OUTRO: TabStyleTourStep = {
  id: 'outro',
  card: 'outro',
  title: 'That Is Tab Style',
  body: 'Everything here applies to the whole tab, for everyone on it.',
};

export function tabStyleTourSteps(): TabStyleTourStep[] {
  return [LOOKS, PAGES, FINE_TUNE, OUTRO];
}
