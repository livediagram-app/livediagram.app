import { describe, expect, it } from 'vitest';
import { DRAW_TOUR_STEPS, drawTourSteps, drawTourStepTelemetryType } from './draw-tour-steps';

// docs/specs/023-draw-mode/draw-tour.md "The steps"
describe('the Draw tour steps', () => {
  it('runs the Drawing tools, Quick Style, Shapes and Settings, then the outro', () => {
    expect(DRAW_TOUR_STEPS.map((s) => s.id)).toEqual([
      'drawing-tools',
      'quick-style',
      'shapes',
      'settings',
      'outro',
    ]);
    expect(DRAW_TOUR_STEPS.slice(0, -1).map((s) => s.target)).toEqual([
      'dock-drawing',
      'quick-style',
      'dock-shapes',
      'dock-settings',
    ]);
  });

  it('leaves Quick Style out on a phone, which has no panel', () => {
    expect(drawTourSteps({ mobile: false }).map((s) => s.id)).toContain('quick-style');
    expect(drawTourSteps({ mobile: true }).map((s) => s.id)).not.toContain('quick-style');
  });

  it('opens on a step, with no welcome card, and closes ready to draw', () => {
    expect(DRAW_TOUR_STEPS[0]?.card).toBeUndefined();
    expect(DRAW_TOUR_STEPS.at(-1)).toMatchObject({ card: 'outro', title: "You're ready to draw" });
  });

  it('titles every step in Title Case, with no em dash anywhere', () => {
    for (const step of DRAW_TOUR_STEPS.filter((s) => !s.card))
      for (const word of step.title.split(' ').filter((w) => w.length > 3))
        expect(word[0], step.title).toBe(word[0]!.toUpperCase());
    for (const step of DRAW_TOUR_STEPS) expect(`${step.title} ${step.body}`).not.toMatch(/—/);
  });

  it('names its step views', () => {
    expect(drawTourStepTelemetryType('drawing-tools')).toBe('DrawTourStepDrawingTools');
  });
});
