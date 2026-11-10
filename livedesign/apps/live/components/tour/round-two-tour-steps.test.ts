// @vitest-environment jsdom

// The round-two element tours (docs/specs/007-editor/element-tours.md): the stack tour, on its element's own parts,
// and the menu step the tours share.

import { describe, expect, it } from 'vitest';
import type { ElementTourApi } from '@liveworkspace/workbench/components/tour/element-tour-api';
import { menuStep, type MenuTourEnv } from './menu-tour-step';
import { stackTourSteps } from './stack-tour-steps';
import type { TourStepOf } from '@liveworkspace/workbench/components/tour/tour-step';

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
