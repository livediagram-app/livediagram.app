// @vitest-environment jsdom

// The Funnel tour (docs/specs/007-editor/element-tours.md "The Funnel tour"): its stages, the number on a band, and
// Build from the top.

import { describe, expect, it, vi } from 'vitest';
import type { ElementTourApi } from '@liveworkspace/workbench/components/tour/element-tour-api';
import { funnelTourSteps } from './funnel-tour-steps';
import type { ConceptTourContext } from './concept-element-tour-steps';

vi.mock('@liveworkspace/workbench/components/tour/tour-dom', () => ({
  waitForSelector: async () => null,
}));

const rows = [
  { label: 'Visited', note: '12,400' },
  { label: 'Signed up' },
  { label: 'Retained', note: '210' },
];
const ctxOf = (over: Partial<ConceptTourContext> = {}): ConceptTourContext => ({
  elementId: 'fu',
  rows,
  touch: false,
  ...over,
});
const api = () => ({ previewConcept: vi.fn(), clearPreview: vi.fn() }) as unknown as ElementTourApi;

describe('funnelTourSteps', () => {
  it('walks the stages, a stage, a value, adding, the shapes, colours and Build', () => {
    expect(funnelTourSteps(ctxOf()).map((s) => s.id)).toEqual([
      'stages',
      'edit',
      'values',
      'add',
      'shape',
      'colours',
      'animate',
      'outro',
    ]);
  });

  it('leaves out the values with none, and keeps the shapes step in the menu', () => {
    const ids = funnelTourSteps(ctxOf({ rows: [{ label: 'A' }, { label: 'B' }] })).map((s) => s.id);
    expect(ids).not.toContain('values');
    expect(ids).toContain('shape');
  });

  it("points at the first band's value, the last band and Add Tier", () => {
    const steps = funnelTourSteps(ctxOf());
    const sel = (id: string) => steps.find((s) => s.id === id)!.selector!(api());
    expect(sel('values')).toBe('[data-element-id="fu"] [data-concept-note="0"]');
    expect(sel('colours')).toBe('[data-element-id="fu"] [data-concept-row="2"]');
    expect(sel('add')).toBe('[data-quick-ring] button[aria-label="Add Tier"]');
  });

  it('previews Build from the top down', async () => {
    const a = api();
    const animate = funnelTourSteps(ctxOf()).find((s) => s.id === 'animate')!;
    expect(animate.body).toContain('from the top down');
    await animate.prepare!(a);
    expect(a.previewConcept).toHaveBeenCalledWith('build');
  });

  it('says tap on a touch screen, and ends on its card', () => {
    const steps = funnelTourSteps(ctxOf({ touch: true }));
    expect(steps.find((s) => s.id === 'values')!.body).toContain('Tap it to edit');
    expect(steps.at(-1)).toMatchObject({ card: 'outro', title: 'That Is a Funnel' });
  });
});
