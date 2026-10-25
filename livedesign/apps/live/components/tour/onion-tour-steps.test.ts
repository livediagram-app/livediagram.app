// @vitest-environment jsdom

// The Onion tour (docs/specs/007-editor/element-tours.md "The Onion tour"): the core, the rings out from it, and Pulse
// rippling outward.

import { describe, expect, it, vi } from 'vitest';
import type { ElementTourApi } from '@liveworkspace/workbench/components/tour/element-tour-api';
import { onionTourSteps } from './onion-tour-steps';
import type { ConceptTourContext } from './concept-element-tour-steps';

vi.mock('@liveworkspace/workbench/components/tour/tour-dom', () => ({
  waitForSelector: async () => null,
}));

const rows = ['Domain', 'Application', 'Adapters', 'Infrastructure'].map((label) => ({ label }));
const ctxOf = (over: Partial<ConceptTourContext> = {}): ConceptTourContext => ({
  elementId: 'on',
  rows,
  hasMore: true,
  touch: false,
  ...over,
});
const api = () => ({ previewConcept: vi.fn(), clearPreview: vi.fn() }) as unknown as ElementTourApi;

describe('onionTourSteps', () => {
  it('walks the rings, the core, the outside, adding, the menu and Pulse', () => {
    expect(onionTourSteps(ctxOf()).map((s) => s.id)).toEqual([
      'rings',
      'core',
      'outer',
      'add',
      'rows',
      'animate',
      'outro',
    ]);
    expect(onionTourSteps(ctxOf({ hasMore: false })).map((s) => s.id)).not.toContain('rows');
  });

  it('points at the core, the outermost ring and Add Ring', () => {
    const steps = onionTourSteps(ctxOf());
    const sel = (id: string) => steps.find((s) => s.id === id)!.selector!(api());
    expect(sel('core')).toBe('[data-element-id="on"] [data-concept-row="0"]');
    expect(sel('outer')).toBe('[data-element-id="on"] [data-concept-row="3"]');
    expect(sel('add')).toBe('[data-quick-ring] button[aria-label="Add Ring"]');
    expect(steps[0]!.body).toContain('Its 4 rings');
  });

  it('previews Pulse rippling outward, and says tap on a touch screen', async () => {
    const a = api();
    await onionTourSteps(ctxOf()).find((s) => s.id === 'animate')!.prepare!(a);
    expect(a.previewConcept).toHaveBeenCalledWith('pulse');
    expect(onionTourSteps(ctxOf({ touch: true })).find((s) => s.id === 'core')!.body).toContain(
      'Tap its name',
    );
  });
});
