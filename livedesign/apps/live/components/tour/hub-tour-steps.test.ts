// @vitest-environment jsdom

// The Hub and Spoke tour (docs/specs/007-editor/element-tours.md "The Hub and Spoke tour"): the hub, its satellites,
// the spokes, and Pulse previewed round them.

import { describe, expect, it, vi } from 'vitest';
import type { ElementTourApi } from '@liveworkspace/workbench/components/tour/element-tour-api';
import { hubTourSteps } from './hub-tour-steps';
import type { ConceptTourContext } from './concept-element-tour-steps';

vi.mock('@liveworkspace/workbench/components/tour/tour-dom', () => ({
  waitForSelector: async () => null,
}));

const rows = ['Payments', 'Stock', 'Email', 'Search', 'Analytics'].map((label) => ({ label }));
const ctxOf = (over: Partial<ConceptTourContext> = {}): ConceptTourContext => ({
  elementId: 'hb',
  rows,
  hasMore: true,
  touch: false,
  ...over,
});
const api = () => ({ previewConcept: vi.fn(), clearPreview: vi.fn() }) as unknown as ElementTourApi;

describe('hubTourSteps', () => {
  it('starts at the hub, then its satellites, one, adding, the spokes and Pulse', () => {
    expect(hubTourSteps(ctxOf()).map((s) => s.id)).toEqual([
      'hub',
      'satellites',
      'edit',
      'add',
      'spokes',
      'animate',
      'outro',
    ]);
    expect(hubTourSteps(ctxOf({ hasMore: false })).map((s) => s.id)).not.toContain('spokes');
  });

  it('points at the hub, the first satellite and Add Satellite, and counts the satellites', () => {
    const steps = hubTourSteps(ctxOf());
    const sel = (id: string) => steps.find((s) => s.id === id)!.selector!(api());
    expect(sel('hub')).toBe('[data-element-id="hb"] [data-tour-part="concept-centre"]');
    expect(sel('edit')).toBe('[data-element-id="hb"] [data-concept-row="0"]');
    expect(sel('add')).toBe('[data-quick-ring] button[aria-label="Add Satellite"]');
    expect(steps.find((s) => s.id === 'satellites')!.body).toContain('Its 5 satellites');
  });

  it('previews Pulse travelling round the satellites', async () => {
    const a = api();
    await hubTourSteps(ctxOf()).find((s) => s.id === 'animate')!.prepare!(a);
    expect(a.previewConcept).toHaveBeenCalledWith('pulse');
  });

  it('says double-tap and tap on a touch screen', () => {
    const steps = hubTourSteps(ctxOf({ touch: true }));
    expect(steps.find((s) => s.id === 'hub')!.body).toContain('Double-tap it');
    expect(steps.find((s) => s.id === 'edit')!.body).toMatch(/^Tap/);
  });
});
