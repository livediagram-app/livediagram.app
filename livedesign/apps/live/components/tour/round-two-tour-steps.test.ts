// @vitest-environment jsdom

// The round-two element tours (docs/specs/007-editor/element-tours.md): the stack and tab window tours, each on its
// element's own parts, and the menu step they share.

import { describe, expect, it } from 'vitest';
import { createShape, type Element } from '@livedesign/document';
import { ELEMENT_TOUR_DEFS } from './element-tour-defs';
import type { ElementTourApi } from './element-tour-api';
import { menuStep, type MenuTourEnv } from './menu-tour-step';
import { stackTourSteps } from './stack-tour-steps';
import { tabWindowTourSteps } from './tab-window-tour-steps';
import type { TourStepOf } from './tour-step';

const env: MenuTourEnv = { elementId: 'el', hasMore: true, touch: false };
type Step = TourStepOf<ElementTourApi>;
const ids = (steps: Step[]) => steps.map((s) => s.id);
const step = (steps: Step[], id: string) => steps.find((s) => s.id === id)!;
const ringed = (s: Step) => s.selector!({} as ElementTourApi);

describe('menuStep', () => {
  it('opens the menu to its path and rings it, saying how to get there', () => {
    const more = menuStep(env, 'menu', 'Menu', 'Tools, then Stack.', ['Tools', 'Stack']);
    expect(ringed(more)).toBe('[data-tour-menu-target]');
    expect(more.body).toBe('More, then Tools, then Stack.');
    const right = menuStep({ ...env, hasMore: false }, 'menu', 'Menu', 'Tools, then Stack.', [
      'Tools',
      'Stack',
    ]);
    expect(ringed(right)).toBe('[data-tour-menu-target]');
    expect(right.body).toBe('Right-click it, then Tools, then Stack.');
  });
});

describe('stackTourSteps', () => {
  it('rings its first child for a reorder, and asks for a drop on an empty stack', () => {
    const full = stackTourSteps({ ...env, direction: 'grid', firstChildId: 'kid' });
    expect(ids(full)).toEqual(['stack', 'child', 'carry', 'menu', 'outro']);
    expect(ringed(step(full, 'child'))).toBe('[data-element-id="kid"]');
    expect(full[0]!.body).toContain('in a grid');
    const empty = stackTourSteps({ ...env, direction: 'row', firstChildId: null });
    expect(ids(empty)).toEqual(['stack', 'drop', 'carry', 'menu', 'outro']);
  });
});

describe('tabWindowTourSteps', () => {
  it('rings Open on a window showing a tab, and Choose a Tab on one that is not', () => {
    const shown = tabWindowTourSteps({ ...env, chosen: true });
    expect(ids(shown)).toEqual(['window', 'open', 'menu', 'size', 'outro']);
    expect(ringed(step(shown, 'open'))).toBe('[data-element-id="el"] [data-tab-window-open]');
    const empty = tabWindowTourSteps({ ...env, chosen: false });
    expect(ids(empty)).toEqual(['window', 'choose', 'menu', 'size', 'outro']);
    expect(ringed(step(empty, 'choose'))).toBe('[data-element-id="el"] [data-tab-window-choose]');
  });
});

describe('the registry reads what is on screen when Play is pressed', () => {
  const env2 = (el: Element) => ({ hasMore: true, touch: false, elements: [el] });

  it("rings a tab window's Open button only when it draws one", () => {
    const win = { ...createShape('tab-window', 0, 0), id: 'w1' } as Element;
    expect(ids(ELEMENT_TOUR_DEFS['tab-window'].steps(win, env2(win)))).toContain('choose');
    document.body.innerHTML =
      '<div data-element-id="w1"><button data-tab-window-open></button></div>';
    expect(ids(ELEMENT_TOUR_DEFS['tab-window'].steps(win, env2(win)))).toContain('open');
    document.body.innerHTML = '';
  });
});
