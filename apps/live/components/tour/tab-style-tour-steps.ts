// The steps of Show Me in the Tab Style dialog (docs/specs/011-theme/canvas-and-theme-dialog.md "Show Me"): a tour of
// the dialog's home, run on the dialog itself. Each step brings the home forward (a panel may be open) and scrolls
// its control into view; the control stays usable, so the person can pick a look or open a panel while it is up.
import type { TourStepOf } from './tour-step';

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
  prepare: (api) => api.showHome(),
});

const LOOKS = step(
  'looks',
  'One-Click Looks',
  'A look sets the tab’s colours, font and canvas at once.',
  'tab-style-looks',
);

const PAGES = step(
  'pages',
  'More Looks',
  'Use the arrows, or swipe, for more looks.',
  'tab-style-looks-nav',
);

const FINE_TUNE = step(
  'fine-tune',
  'Fine-Tune Any Part',
  'Change just one thing: open its row.',
  'tab-style-fine-tune',
);

const OUTRO: TabStyleTourStep = {
  id: 'outro',
  card: 'outro',
  title: 'That Is Tab Style',
  body: 'These apply to the whole tab, for everyone.',
};

export function tabStyleTourSteps(): TabStyleTourStep[] {
  return [LOOKS, PAGES, FINE_TUNE, OUTRO];
}
