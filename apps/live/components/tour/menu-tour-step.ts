import { onGraphic } from './concept-element-tour-steps';
import type { ElementTourApi } from './element-tour-api';
import type { TourStepOf } from './tour-step';
import { elementSelector } from '@/lib/canvas-selectors';

// What a round-two element tour knows of where it runs (docs/specs/007-editor/element-tours.md "Menu steps on the
// elements of round two").
export type MenuTourEnv = { elementId: string; hasMore: boolean; touch: boolean };

// The step on an element's own menu section. These elements are edited mostly from there, so the step is kept for
// everyone: it rings More while More shows, and otherwise (a power user on a desktop right-clicks) the element itself.
// `body` follows the opening words: `More, then ${body}` or `Right-click it, then ${body}`.
export function menuStep(
  env: MenuTourEnv,
  id: string,
  title: string,
  body: string,
): TourStepOf<ElementTourApi> {
  return env.hasMore
    ? onGraphic(id, title, `More, then ${body}`, '#selection-more-actions')
    : onGraphic(id, title, `Right-click it, then ${body}`, elementSelector(env.elementId));
}

// "Click" or "Tap", "Double-click" or "Double-tap", as the screen is pressed.
export const pressWord = (env: Pick<MenuTourEnv, 'touch'>) => (env.touch ? 'Tap' : 'Click');
export const doublePressWord = (env: Pick<MenuTourEnv, 'touch'>) =>
  env.touch ? 'Double-tap' : 'Double-click';
