// The Flowchart tour (docs/specs/007-editor/element-tours.md "The Flowchart tour"): growing a chart from the keyboard
// or the step's toolbar, its type and lane, and the Flowchart menu.

import { describe, expect, it } from 'vitest';
import type { ElementTourApi } from './element-tour-api';
import { flowchartTourSteps, type FlowchartTourContext } from './flowchart-tour-steps';

const ctxOf = (over: Partial<FlowchartTourContext> = {}): FlowchartTourContext => ({
  elementId: 'st',
  hasMore: true,
  touch: false,
  hasLanes: false,
  ...over,
});
const api = {} as ElementTourApi;

describe('flowchartTourSteps', () => {
  it('walks the step, Add Step, Add Branch, Step Type and the menu', () => {
    expect(flowchartTourSteps(ctxOf()).map((s) => s.id)).toEqual([
      'step',
      'next',
      'branch',
      'type',
      'menu',
      'outro',
    ]);
  });

  it('adds the Lane step on a chart with lanes, and leaves out the menu where More is not shown', () => {
    const ids = flowchartTourSteps(ctxOf({ hasLanes: true, hasMore: false })).map((s) => s.id);
    expect(ids).toContain('lane');
    expect(ids).not.toContain('menu');
  });

  it("points at the step's toolbar buttons", () => {
    const steps = flowchartTourSteps(ctxOf({ hasLanes: true }));
    const sel = (id: string) => steps.find((s) => s.id === id)!.selector!(api);
    expect(sel('next')).toBe('[data-testid="selection-popover"] button[aria-label="Add Step"]');
    expect(sel('branch')).toBe('[data-testid="selection-popover"] button[aria-label="Add Branch"]');
    expect(sel('type')).toBe('[data-testid="selection-popover"] button[aria-label="Step Type"]');
    expect(sel('lane')).toBe('[data-testid="selection-popover"] button[aria-label="Lane"]');
  });

  it('names Tab and Enter on a keyboard, and only the buttons on a touch screen', () => {
    const keys = flowchartTourSteps(ctxOf());
    expect(keys.find((s) => s.id === 'next')!.body).toMatch(/^Tab, or Add Step/);
    expect(keys.find((s) => s.id === 'branch')!.body).toMatch(/^Enter, or Add Branch/);
    const touch = flowchartTourSteps(ctxOf({ touch: true }));
    expect(touch.find((s) => s.id === 'next')!.body).not.toContain('Tab');
    expect(touch.find((s) => s.id === 'branch')!.body).toMatch(/^Add Branch adds/);
  });

  it('speaks of another lane once the chart has lanes, and ends on its card', () => {
    const menu = (hasLanes: boolean) =>
      flowchartTourSteps(ctxOf({ hasLanes })).find((s) => s.id === 'menu')!.body;
    expect(menu(false)).toContain('Add Lane for swimlanes');
    expect(menu(true)).toContain('Add Lane for another swimlane');
    expect(flowchartTourSteps(ctxOf()).at(-1)).toMatchObject({
      card: 'outro',
      title: 'That Is a Flowchart',
    });
  });
});
