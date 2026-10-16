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
      'It shows a tab of this document, fitted inside it, and follows every change made there. One source of truth: no stale copies on your slides.',
      elementSelector(id),
    ),
    ctx.chosen
      ? onGraphic(
          'open',
          'Open It to Edit',
          'The window is a picture of the tab: to change what it shows, Open goes there. Come back and the window is up to date.',
          elementSelector(id, '[data-tab-window-open]'),
        )
      : onGraphic(
          'choose',
          'Choose a Tab',
          `${pressWord(ctx)} it to pick the tab it shows, in tab-bar order. This tab and Plan tabs are left out.`,
          elementSelector(id, '[data-tab-window-choose]'),
        ),
    menuStep(
      ctx,
      'menu',
      'The Tab Window Menu',
      'Tools, then Tab Window: Shows picks another tab, and Open goes to the one it shows.',
    ),
    onGraphic(
      'size',
      'Any Size',
      'Resize it as you like: the tab stays fitted inside, never cropped, its words growing with the window.',
      elementSelector(id),
    ),
    conceptOutro(
      'That Is a Tab Window',
      'A PDF, PNG or SVG export draws the tab inside it, exactly as on screen.',
    ),
  ];
}
