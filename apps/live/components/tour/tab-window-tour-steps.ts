import { conceptOutro, onGraphic } from './concept-element-tour-steps';
import type { ElementTourApi } from './element-tour-api';
import { menuStep, pressWord, type MenuTourEnv } from './menu-tour-step';
import type { TourStepOf } from './tour-step';
import { elementSelector } from '@/lib/canvas-selectors';

// The Tab Window tour (docs/specs/007-editor/element-tours.md "The Tab Window tour"), on a selected tab window: another
// tab drawn live inside it, Open to edit that tab (or, with none chosen yet, Choose a Tab), its menu, and resizing. It
// never chooses or opens a tab itself: opening one leaves this tab, which ends the tour.

type TabWindowTourContext = MenuTourEnv & {
  // It shows a tab, so its Open button is there; otherwise its Choose a Tab button is.
  chosen: boolean;
};

export function tabWindowTourSteps(ctx: TabWindowTourContext): TourStepOf<ElementTourApi>[] {
  const { elementId: id } = ctx;
  return [
    onGraphic(
      'window',
      'Another Tab, Live',
      'It shows another tab, live. Change that tab and this updates.',
      elementSelector(id),
    ),
    ctx.chosen
      ? onGraphic(
          'open',
          'Open It to Edit',
          'Open takes you to the tab it shows, to edit it there.',
          elementSelector(id, '[data-tab-window-open]'),
        )
      : onGraphic(
          'choose',
          'Choose a Tab',
          `${pressWord(ctx)} it to pick which tab it shows.`,
          elementSelector(id, '[data-tab-window-choose]'),
        ),
    menuStep(ctx, 'menu', 'The Tab Window Menu', 'Tools › Tab Window switches the tab it shows.'),
    onGraphic(
      'size',
      'Any Size',
      'Resize it freely; the tab always fits inside.',
      elementSelector(id),
    ),
    conceptOutro('That Is a Tab Window', 'Exports show it exactly as on screen.'),
  ];
}
