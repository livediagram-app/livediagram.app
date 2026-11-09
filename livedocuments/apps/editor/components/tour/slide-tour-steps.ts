// The Slides track of the Pages tour (docs/specs/007-editor/pages-tour.md "Slides track"): on the person's own
// slide, it opens the Layout and Background popovers to choose from, points at the +, then at the slide's row in
// Contents (the show's order), opens that row's menu (its place in the show) and points at Present. Each control
// stays live, so a pick made while its step is up is kept. On a phone the looks open from Appearance, Contents from
// its button, and there is no Present (pages-tour.md "On a phone").
import type { PageTourStep } from './page-tour-api';
import { HEADER_PRESENT } from './page-tour-dom';
import {
  addPageStep,
  contentsMenuStep,
  contentsRowStep,
  lookStep,
  type TrackOptions,
} from './page-tour-parts';

export function slideTourSteps({ phone = false }: TrackOptions = {}): PageTourStep[] {
  return [
    lookStep(
      {
        id: 'layouts',
        title: 'Choose a Layout',
        body: 'Hover a layout to preview it. Press it to use it.',
      },
      'Layout',
    ),
    lookStep(
      {
        id: 'background',
        title: 'Change the Background',
        body: 'Colours, gradients, pictures or animated backgrounds. Hover to preview, press to keep.',
      },
      'Background',
    ),
    addPageStep({ id: 'add-page', title: 'Add Slide', body: '+ adds the next slide.' }),
    contentsRowStep({
      id: 'contents',
      title: 'Your Slides',
      body: 'Every slide is in the show already, in this order. Drag a slide to move it; press one to go to it.',
    }),
    contentsMenuStep({
      id: 'slide-menu',
      title: 'Each Slide’s Menu',
      body: 'Hide a slide from the show without deleting it, or present from it.',
    }),
    {
      id: 'present',
      title: 'Present',
      body: 'Present runs the show full screen. Arrow keys move through it; Escape ends it. Transitions are in Settings, under Presenting.',
      selector: () => HEADER_PRESENT,
    },
    {
      id: 'outro',
      card: 'outro',
      title: "You're ready to present",
      // A phone presents nothing (presentation-mode.md): the show is given from a bigger screen.
      body: phone
        ? 'Make your next slide. Present it from a tablet or computer.'
        : 'Make your next slide. Present when you are ready.',
    },
  ];
}
