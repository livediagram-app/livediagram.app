// @vitest-environment jsdom

// The Cycle tour (docs/specs/007-editor/element-tours.md "The Cycle tour"): the ring, the first step, the middle, and
// Flow previewed round its arrows.

import { describe, expect, it, vi } from 'vitest';
import type { ElementTourApi } from './element-tour-api';
import { cycleTourSteps } from './cycle-tour-steps';
import type { ConceptTourContext } from './concept-element-tour-steps';

vi.mock('./tour-dom', () => ({ waitForSelector: async () => null }));

const rows = [{ label: 'Plan' }, { label: 'Do' }, { label: 'Check' }, { label: 'Act' }];
const ctxOf = (over: Partial<ConceptTourContext> = {}): ConceptTourContext => ({
  elementId: 'cy',
  rows,
  hasMore: true,
  touch: false,
  ...over,
});
const api = () => ({ previewConcept: vi.fn(), clearPreview: vi.fn() }) as unknown as ElementTourApi;

describe('cycleTourSteps', () => {
  it('walks the ring, the first step, the middle, adding, the menu and Flow', () => {
    expect(cycleTourSteps(ctxOf()).map((s) => s.id)).toEqual([
      'loop',
      'first',
      'centre',
      'add',
      'rows',
      'animate',
      'outro',
    ]);
    expect(cycleTourSteps(ctxOf({ hasMore: false })).map((s) => s.id)).not.toContain('rows');
  });

  it('points at the first step, the middle and Add Step, and counts the steps', () => {
    const steps = cycleTourSteps(ctxOf());
    const sel = (id: string) => steps.find((s) => s.id === id)!.selector!(api());
    expect(sel('first')).toBe('[data-element-id="cy"] [data-concept-row="0"]');
    expect(sel('centre')).toBe('[data-element-id="cy"] [data-tour-part="concept-centre"]');
    expect(sel('add')).toBe('[data-quick-ring] button[aria-label="Add Step"]');
    expect(steps[0]!.body).toContain('Its 4 steps');
  });

  it('previews Flow, the loop only a cycle has', async () => {
    const a = api();
    await cycleTourSteps(ctxOf()).find((s) => s.id === 'animate')!.prepare!(a);
    expect(a.previewConcept).toHaveBeenCalledWith('flow');
  });

  it('says tap and double-tap on a touch screen', () => {
    const steps = cycleTourSteps(ctxOf({ touch: true }));
    expect(steps.find((s) => s.id === 'first')!.body).toContain('Tap a step');
    expect(steps.find((s) => s.id === 'centre')!.body).toMatch(/^Double-tap/);
  });
});
