// @vitest-environment jsdom

// The Chevrons tour (docs/specs/007-editor/element-tours.md "The Chevrons tour"): the stages, a stage's own bar held
// open by its step, the notes, and Pulse running along.

import { describe, expect, it, vi } from 'vitest';
import type { ElementTourApi } from './element-tour-api';
import { chevronsTourSteps } from './chevrons-tour-steps';
import type { ConceptTourContext } from './concept-element-tour-steps';

vi.mock('./tour-dom', () => ({ waitForSelector: async () => null }));

const rows = [
  { label: 'Commit', note: 'push to main' },
  { label: 'Build' },
  { label: 'Release', note: 'manual gate' },
];
const ctxOf = (over: Partial<ConceptTourContext> = {}): ConceptTourContext => ({
  elementId: 'ch',
  rows,
  hasMore: true,
  touch: false,
  ...over,
});
const api = () =>
  ({
    previewConcept: vi.fn(),
    showStageBar: vi.fn(),
    clearPreview: vi.fn(),
  }) as unknown as ElementTourApi;

describe('chevronsTourSteps', () => {
  it('walks the stages, a stage, its bar, a note, adding and Pulse, with no menu step', () => {
    expect(chevronsTourSteps(ctxOf()).map((s) => s.id)).toEqual([
      'stages',
      'edit',
      'bar',
      'notes',
      'add',
      'animate',
      'outro',
    ]);
    expect(
      chevronsTourSteps(ctxOf({ rows: [{ label: 'A' }, { label: 'B' }] })).map((s) => s.id),
    ).not.toContain('notes');
  });

  it("holds the middle stage's bar open, and lets it go on leaving", async () => {
    const steps = chevronsTourSteps(ctxOf());
    const bar = steps.find((s) => s.id === 'bar')!;
    const a = api();
    await bar.prepare!(a);
    // No bar drawn (a stage too small for one): the step rings the stage itself.
    expect(bar.selector!(a)).toBe('[data-element-id="ch"] [data-concept-row-zone="1"]');
    document.body.innerHTML =
      '<div data-element-id="ch"><div data-concept-row-bar aria-label="Stage 2"></div></div>';
    expect(bar.selector!(a)).toBe(
      '[data-element-id="ch"] [data-concept-row-bar][aria-label="Stage 2"]',
    );
    document.body.innerHTML = '';
    expect(a.showStageBar).toHaveBeenCalledWith(1);
    bar.cleanup!(a);
    expect(a.clearPreview).toHaveBeenCalled();
  });

  it("holds the first stage's bar on a two-stage process", async () => {
    const a = api();
    const bar = chevronsTourSteps(ctxOf({ rows: [{ label: 'A' }, { label: 'B' }] })).find(
      (s) => s.id === 'bar',
    )!;
    await bar.prepare!(a);
    expect(a.showStageBar).toHaveBeenCalledWith(0);
  });

  it('says every stage shows its bar on a touch screen', () => {
    const touch = chevronsTourSteps(ctxOf({ touch: true })).find((s) => s.id === 'bar')!;
    expect(touch.body).toMatch(/^Each stage has a small bar while selected/);
    const mouse = chevronsTourSteps(ctxOf()).find((s) => s.id === 'bar')!;
    expect(mouse.body).toMatch(/^Point at a stage/);
  });

  it('points at a note and Add Stage, and previews Pulse', async () => {
    const steps = chevronsTourSteps(ctxOf());
    const sel = (id: string) => steps.find((s) => s.id === id)!.selector!(api());
    expect(sel('notes')).toBe('[data-element-id="ch"] [data-concept-note="0"]');
    expect(sel('add')).toBe('[data-quick-ring] button[aria-label="Add Stage"]');
    const a = api();
    await steps.find((s) => s.id === 'animate')!.prepare!(a);
    expect(a.previewConcept).toHaveBeenCalledWith('pulse');
  });
});
