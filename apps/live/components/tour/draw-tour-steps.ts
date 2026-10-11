// The steps of the Draw tour (docs/specs/023-draw-mode/draw-tour.md "The steps"): a welcome card, the dock's Drawing
// tools, the Quick Style panel, the dock's Shapes and Settings, then the outro. It places nothing; the one thing it
// changes, a marker picked up to show Quick Style, it puts back down.

import { findTour, waitForTour } from './tour-dom';
import { stepTelemetryType, type TourStepOf } from './tour-step';

const dockItem = (key: string) =>
  document.querySelector<HTMLElement>(`[data-whiteboard-dock] [data-dock-item="${key}"]`);

// Whether the Quick Style step picked up the first marker to show the panel, so its cleanup puts it down again.
let markerPickedUp = false;

// Nothing to drive beyond the DOM: the tour makes no content (spec "Tour content").
export type DrawTourApi = Record<string, never>;

export type DrawTourStep = TourStepOf<DrawTourApi>;

export const DRAW_TOUR_STEPS: DrawTourStep[] = [
  {
    id: 'welcome',
    card: 'welcome',
    title: 'Getting started with Draw?',
    body: 'Want a quick tour of the pens, shapes and tools so you can sketch ideas in minutes?',
  },
  {
    id: 'drawing-tools',
    title: 'Pens and Tools',
    body: 'Select, three markers, Text, the Path tool and the Eraser. Press the marker in your hand again to change its colour and width.',
    target: 'dock-drawing',
  },
  {
    id: 'quick-style',
    title: 'Quick Style',
    body: "Colour and width for the marker in your hand, or for whatever you've selected: restyle a stroke, shape or text after drawing it.",
    target: 'quick-style',
    // The panel is a desktop's (a phone has none).
    mobileSkip: true,
    // It shows with a pen in hand or something selected: with neither, pick up the first marker, as a person would.
    prepare: async () => {
      if (findTour('quick-style')) return;
      const marker = dockItem('main');
      if (!marker) return;
      marker.click();
      markerPickedUp = true;
      await waitForTour('quick-style', 1500);
    },
    cleanup: () => {
      if (!markerPickedUp) return;
      markerPickedUp = false;
      dockItem('select')?.click();
    },
  },
  {
    id: 'shapes',
    title: 'Shapes',
    body: 'Sticky notes and shapes pinned for one tap. Shapes opens every shape and a search, and you can pin your favourites to the dock.',
    target: 'dock-shapes',
  },
  {
    id: 'settings',
    title: 'Board Settings',
    body: "The board's background, your cursor, and whether rough shapes you draw snap into clean ones.",
    target: 'dock-settings',
  },
  {
    id: 'outro',
    card: 'outro',
    title: "You're ready to draw",
    body: 'Pick up a marker and start sketching. The help centre has more on every tool.',
  },
];

// The steps this surface has chrome for, filtered up front so the count stays honest: a phone has no Quick Style.
export function drawTourSteps({ mobile }: { mobile: boolean }): DrawTourStep[] {
  return DRAW_TOUR_STEPS.filter((step) => !(step.mobileSkip && mobile));
}

// Telemetry `type` token for a step-viewed event: 'drawing-tools' → 'DrawTourStepDrawingTools'.
export function drawTourStepTelemetryType(stepId: string): string {
  return stepTelemetryType('DrawTourStep', stepId);
}
