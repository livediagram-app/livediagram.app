// The steps of Show Me in the Tab Style dialog (docs/specs/011-theme/canvas-and-theme-dialog.md "Show Me"): a tour of
// the dialog, run on the dialog itself. The home's steps bring it forward (a panel may be open) and scroll their
// control into view; the Finish steps open the Finish panel, and one of them really redraws the tab in another finish,
// putting the person's own back as it ends, however it ends.
import type { Finish } from '@livedesign/document';
import type { TourStepOf } from './tour-step';

export type TabStyleTourApi = {
  // Brings the home (the looks and the Fine-tune rows) forward.
  showHome: () => void;
  // Opens the Finish panel.
  showFinish: () => void;
  // The tab's finish now, and setting it (as a press on a Finish tile does).
  finish: () => Finish;
  setFinish: (finish: Finish) => void;
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

// The Mashup card leads the looks: a fresh mix rolled on each press.
const MASHUP: TabStyleTourStep = {
  id: 'mashup',
  title: 'Mashup',
  body: 'Mashup rolls a fresh mix of colours, font and canvas. Press it again for another.',
  selector: () => '[data-tour-id="tab-style-looks"] button[aria-label^="Mashup"]',
  prepare: (api) => api.showHome(),
};

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

const FINISH_GROUP = '[role="radiogroup"][aria-label="Finish"]';

const FINISH: TabStyleTourStep = {
  id: 'finish',
  title: 'Finish',
  body: 'How everything is drawn: clean Flexible, crisp Professional, hand-drawn Sketch or bold Marker.',
  selector: () => FINISH_GROUP,
  prepare: (api) => api.showFinish(),
};

// The finish shown off: the one the tab does not wear (Sketch, or Marker on a sketched tab), worn for the step.
const showcaseFinish = (current: Finish): Finish => (current === 'sketch' ? 'marker' : 'sketch');
// The person's own finish while the step has it changed; null otherwise.
let ownFinish: Finish | null = null;

const TRY_FINISH: TabStyleTourStep = {
  id: 'try-finish',
  title: 'See It Change',
  body: 'Your whole tab is redrawn in the finish you pick, as you pick it. Yours comes back on Next.',
  selector: () => FINISH_GROUP,
  prepare: (api) => {
    api.showFinish();
    if (ownFinish !== null) return;
    ownFinish = api.finish();
    api.setFinish(showcaseFinish(ownFinish));
  },
  cleanup: (api) => {
    if (ownFinish === null) return;
    api.setFinish(ownFinish);
    ownFinish = null;
  },
};

const OUTRO: TabStyleTourStep = {
  id: 'outro',
  card: 'outro',
  title: 'That Is Tab Style',
  body: 'These apply to the whole tab, for everyone.',
};

export function tabStyleTourSteps(): TabStyleTourStep[] {
  return [LOOKS, MASHUP, PAGES, FINE_TUNE, FINISH, TRY_FINISH, OUTRO];
}
