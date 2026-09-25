import { describe, expect, it } from 'vitest';
import { TELEMETRY_TYPE_PATTERN } from '@livediagram/api-schema';
import { TOUR_STEPS, tourStepsFor, tourStepTelemetryType } from './tour-steps';

// The tour's stage-view telemetry (spec/79 + spec/22): every step id must
// derive a valid preset `type` token, and the funnel only reads cleanly if
// ids stay unique and the bookends stay at the ends.

describe('tour steps', () => {
  it('has unique ids with welcome first and outro last', () => {
    const ids = TOUR_STEPS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(TOUR_STEPS[0]!.card).toBe('welcome');
    expect(TOUR_STEPS[TOUR_STEPS.length - 1]!.card).toBe('outro');
  });

  it('derives valid telemetry type tokens for every step', () => {
    for (const step of TOUR_STEPS) {
      const type = tourStepTelemetryType(step.id);
      expect(type).toMatch(TELEMETRY_TYPE_PATTERN);
      expect(type.startsWith('TourStep')).toBe(true);
    }
    expect(tourStepTelemetryType('selection-modes')).toBe('TourStepSelectionModes');
  });
});

// The effective step list per surface (spec/79): a step whose chrome the
// current surface doesn't render must be dropped up front, so the count
// reads right and the tour never anchors to hidden chrome.
describe('tourStepsFor', () => {
  const ids = (opts: { mobile: boolean; esBoard: boolean }) => tourStepsFor(opts).map((s) => s.id);

  it('keeps every step on a desktop diagram', () => {
    expect(ids({ mobile: false, esBoard: false })).toEqual(TOUR_STEPS.map((s) => s.id));
  });

  it('drops the desktop-only steps on mobile', () => {
    const mobile = ids({ mobile: true, esBoard: false });
    expect(mobile).not.toContain('search');
    expect(mobile).not.toContain('theme-canvas');
    expect(mobile).toContain('palette');
  });

  it('drops the palette-header steps on an event-storming board', () => {
    const board = ids({ mobile: false, esBoard: true });
    expect(board).not.toContain('selection-modes');
    expect(board).not.toContain('categories');
    // The rest of the tour still applies: the board has a palette, an
    // explorer, elements, tabs, a paintbrush, and search.
    expect(board).toContain('palette');
    expect(board).toContain('explorer');
    expect(board).toContain('search');
  });

  // Toolbar layout (spec/148): the Explorer lives behind the top-left menu
  // button, so its step retells its copy and rings the button too; every
  // other step is untouched.
  it('points the Explorer step at the menu button in the Toolbar layout', () => {
    const toolbar = tourStepsFor({ mobile: false, esBoard: false, toolbar: true });
    const explorer = toolbar.find((s) => s.id === 'explorer')!;
    expect(explorer.target).toBe('explorer');
    expect(explorer.alsoHighlight).toBe('dock-explorer');
    expect(explorer.body).toMatch(/menu button/);
    const floating = tourStepsFor({ mobile: false, esBoard: false });
    expect(floating.find((s) => s.id === 'explorer')!.alsoHighlight).toBeUndefined();
    expect(toolbar.map((s) => s.id)).toEqual(floating.map((s) => s.id));
  });

  it('keeps the bookend cards on every surface', () => {
    for (const opts of [
      { mobile: false, esBoard: false },
      { mobile: true, esBoard: false },
      { mobile: false, esBoard: true },
      { mobile: true, esBoard: true },
    ]) {
      const steps = tourStepsFor(opts);
      expect(steps[0]!.card).toBe('welcome');
      expect(steps[steps.length - 1]!.card).toBe('outro');
    }
  });
});
