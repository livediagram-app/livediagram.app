// @vitest-environment jsdom

// The Pyramid tour (docs/specs/007-editor/element-tours.md "The Pyramid tour"): its steps on the selected pyramid,
// worded for an Inverted one too, and the animation it previews.

import { describe, expect, it, vi } from 'vitest';
import type { ElementTourApi } from '@liveworkspace/workbench/components/tour/element-tour-api';
import { pyramidTourSteps } from './pyramid-tour-steps';

vi.mock('@liveworkspace/workbench/components/tour/tour-dom', () => ({
  waitForSelector: async () => null,
}));

const rows = [{ label: 'Vision' }, { label: 'Strategy' }, { label: 'Daily work' }];
const ctxOf = (over: Partial<Parameters<typeof pyramidTourSteps>[0]> = {}) => ({
  elementId: 'py',
  rows,
  touch: false,
  inverted: false,
  ...over,
});
const api = () => ({ previewConcept: vi.fn(), clearPreview: vi.fn() }) as unknown as ElementTourApi;

describe('pyramidTourSteps', () => {
  it('walks the tiers, a tier, adding, the three shapes, colours and Build', () => {
    expect(pyramidTourSteps(ctxOf()).map((s) => s.id)).toEqual([
      'tiers',
      'edit',
      'add',
      'shape',
      'colours',
      'animate',
      'outro',
    ]);
  });

  it('keeps the shapes step in the menu for everyone', () => {
    expect(pyramidTourSteps(ctxOf({})).map((s) => s.id)).toContain('shape');
  });

  it('points at the apex, the base, and the "+" ring\'s Add Tier', () => {
    const steps = pyramidTourSteps(ctxOf());
    const sel = (id: string) => steps.find((s) => s.id === id)!.selector!(api());
    expect(sel('edit')).toBe('[data-element-id="py"] [data-concept-row="0"]');
    expect(sel('colours')).toBe('[data-element-id="py"] [data-concept-row="2"]');
    expect(sel('add')).toBe('[data-quick-ring] button[aria-label="Add Tier"]');
  });

  it('builds a pyramid up from its base, and an inverted one down from its top', () => {
    const up = pyramidTourSteps(ctxOf());
    const down = pyramidTourSteps(ctxOf({ inverted: true }));
    expect(up.find((s) => s.id === 'animate')!.title).toBe('Build It Up');
    expect(up.find((s) => s.id === 'animate')!.body).toContain('from the base up');
    expect(down.find((s) => s.id === 'animate')!.title).toBe('Build It Down');
    expect(down.find((s) => s.id === 'animate')!.body).toContain('from the top down');
    expect(down.find((s) => s.id === 'tiers')!.body).toContain('widest, along the top');
    expect(down.at(-1)!.title).toBe('That Is an Inverted Pyramid');
    expect(up.at(-1)!.title).toBe('That Is a Pyramid');
  });

  it('previews Build on the animation step', async () => {
    const a = api();
    await pyramidTourSteps(ctxOf()).find((s) => s.id === 'animate')!.prepare!(a);
    expect(a.previewConcept).toHaveBeenCalledWith('build');
  });

  it('says tap on a touch screen', () => {
    const edit = pyramidTourSteps(ctxOf({ touch: true })).find((s) => s.id === 'edit')!;
    expect(edit.body).toMatch(/^Tap/);
  });
});
