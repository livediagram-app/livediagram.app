// The Mind Map tour (docs/specs/007-editor/element-tours.md "The Mind Map tour"): growing from the keyboard or the
// toolbar, a branch moved as one, and the Mind Map menu; worded for a touch screen too.

import { describe, expect, it } from 'vitest';
import type { ElementTourApi } from './element-tour-api';
import { mindNodeTourSteps, type MindNodeTourContext } from './mind-node-tour-steps';

const ctxOf = (over: Partial<MindNodeTourContext> = {}): MindNodeTourContext => ({
  elementId: 'mn',
  hasMore: true,
  touch: false,
  hasChildren: true,
  ...over,
});
const api = {} as ElementTourApi;

describe('mindNodeTourSteps', () => {
  it('walks the node, Add Child, Add Sibling, the branch and the menu', () => {
    expect(mindNodeTourSteps(ctxOf()).map((s) => s.id)).toEqual([
      'node',
      'child',
      'sibling',
      'branch',
      'menu',
      'outro',
    ]);
    expect(mindNodeTourSteps(ctxOf({ hasMore: false })).map((s) => s.id)).not.toContain('menu');
  });

  it("points at the node and its toolbar's grow buttons", () => {
    const steps = mindNodeTourSteps(ctxOf());
    const sel = (id: string) => steps.find((s) => s.id === id)!.selector!(api);
    expect(sel('node')).toBe('[data-element-id="mn"]');
    expect(sel('child')).toBe('[data-testid="selection-popover"] button[aria-label="Add Child"]');
    expect(sel('sibling')).toBe(
      '[data-testid="selection-popover"] button[aria-label="Add Sibling"]',
    );
  });

  it('names the keys on a keyboard, and only the buttons on a touch screen', () => {
    const keys = mindNodeTourSteps(ctxOf());
    expect(keys.find((s) => s.id === 'child')!.body).toMatch(/^Press Tab, or Add Child/);
    expect(keys.find((s) => s.id === 'sibling')!.body).toContain('Shift+Enter');
    const touch = mindNodeTourSteps(ctxOf({ touch: true }));
    expect(touch.find((s) => s.id === 'child')!.body).not.toContain('Tab');
    expect(touch.find((s) => s.id === 'sibling')!.body).not.toContain('Enter');
  });

  it('speaks of its own branch when it has one', () => {
    expect(mindNodeTourSteps(ctxOf()).find((s) => s.id === 'branch')!.title).toBe(
      'Move a Whole Branch',
    );
    expect(
      mindNodeTourSteps(ctxOf({ hasChildren: false })).find((s) => s.id === 'branch')!.title,
    ).toBe('Branches Move as One');
  });

  it('ends on its card', () => {
    expect(mindNodeTourSteps(ctxOf()).at(-1)).toMatchObject({
      card: 'outro',
      title: 'That Is a Mind Map',
    });
  });
});
