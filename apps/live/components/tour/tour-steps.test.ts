import { describe, expect, it } from 'vitest';
import { TELEMETRY_TYPE_PATTERN } from '@livediagram/api-schema';
import { TOUR_STEPS, tourStepsFor, tourStepTelemetryType } from './tour-steps';

// The Diagram tour's stage-view telemetry (docs/specs/007-editor/editor-tour.md + docs/specs/017-telemetry/telemetry.md): every step id must
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

// The effective step list per surface (docs/specs/007-editor/editor-tour.md): a step whose chrome the
// current surface doesn't render must be dropped up front, so the count
// reads right and the tour never anchors to hidden chrome.
describe('tourStepsFor', () => {
  const ids = (opts: { mobile: boolean; esBoard: boolean }) => tourStepsFor(opts).map((s) => s.id);

  it('keeps every step on a desktop diagram', () => {
    expect(ids({ mobile: false, esBoard: false })).toEqual(TOUR_STEPS.map((s) => s.id));
  });

  // docs/specs/007-editor/editor-tour.md "The steps": no Tab Mode step; Element Menu follows Palette Categories.
  it('has no Tab Mode step, the Element Menu following Palette Categories', () => {
    const desktop = ids({ mobile: false, esBoard: false });
    expect(desktop).not.toContain('editor-mode');
    expect(desktop.indexOf('context-menu')).toBe(desktop.indexOf('categories') + 1);
  });

  it('drops the desktop-only step on mobile', () => {
    const mobile = ids({ mobile: true, esBoard: false });
    expect(mobile).not.toContain('theme-canvas');
    expect(mobile).toContain('palette');
  });

  it('drops the palette-header steps on an event-storming board', () => {
    const board = ids({ mobile: false, esBoard: true });
    expect(board).not.toContain('selection-modes');
    expect(board).not.toContain('categories');
    // The rest of the tour still applies: the board has a palette, elements,
    // tabs, and a paintbrush.
    expect(board).toEqual(['welcome', 'palette', 'context-menu', 'tabs', 'theme-canvas', 'outro']);
  });

  it('counts six steps on a desktop diagram, five on a phone and three on a phone board', () => {
    const count = (opts: { mobile: boolean; esBoard: boolean }) =>
      tourStepsFor(opts).filter((s) => !s.card).length;
    expect(count({ mobile: false, esBoard: false })).toBe(6);
    expect(count({ mobile: true, esBoard: false })).toBe(5);
    expect(count({ mobile: true, esBoard: true })).toBe(3);
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

// docs/specs/007-editor/editor-tour.md: the tour is about diagramming, named for Diagram mode, and leaves the
// app-wide Explorer to its own help article.
describe('the Diagram tour copy', () => {
  it('offers a tour of diagramming and sends them off to diagram', () => {
    const welcome = TOUR_STEPS[0]!;
    const outro = TOUR_STEPS[TOUR_STEPS.length - 1]!;
    expect(welcome.title).toBe('New to diagrams?');
    expect(welcome.body).toMatch(/quick look at the editor/);
    expect(outro.title).toBe("You're ready to diagram");
  });

  it('has no Explorer step', () => {
    expect(TOUR_STEPS.map((s) => s.id)).not.toContain('explorer');
  });

  it('titles every step in Title Case', () => {
    for (const step of TOUR_STEPS.filter((s) => !s.card))
      for (const word of step.title.split(' ').filter((w) => w !== '&' && w !== 'the'))
        expect(word.charAt(0)).toBe(word.charAt(0).toUpperCase());
  });
});
