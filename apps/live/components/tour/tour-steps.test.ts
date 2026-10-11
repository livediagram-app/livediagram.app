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

  // docs/specs/007-editor/editor-tour.md "The steps": Tab Mode follows Palette Categories.
  it('shows the Tab Mode step after Palette Categories, opening the switch menu', () => {
    const desktop = ids({ mobile: false, esBoard: false });
    expect(desktop.indexOf('editor-mode')).toBe(desktop.indexOf('categories') + 1);
    const step = TOUR_STEPS.find((s) => s.id === 'editor-mode')!;
    expect(step).toMatchObject({ target: 'editor-mode-menu', alsoHighlight: 'editor-mode' });
    // A phone shows no switch (docs/specs/007-editor/editor-modes.md "The mode switch").
    expect(ids({ mobile: true, esBoard: false })).not.toContain('editor-mode');
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
    // Nor a mode switch: a board is always Diagram.
    expect(board).not.toContain('editor-mode');
    // The rest of the tour still applies: the board has a palette, elements,
    // tabs, and a paintbrush.
    expect(board).toEqual(['welcome', 'palette', 'context-menu', 'tabs', 'theme-canvas', 'outro']);
  });

  it('counts seven steps on a desktop diagram, five on a phone and three on a phone board', () => {
    const count = (opts: { mobile: boolean; esBoard: boolean }) =>
      tourStepsFor(opts).filter((s) => !s.card).length;
    expect(count({ mobile: false, esBoard: false })).toBe(7);
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
  it('welcomes the person to Diagram and sends them off to diagram', () => {
    const welcome = TOUR_STEPS[0]!;
    const outro = TOUR_STEPS[TOUR_STEPS.length - 1]!;
    expect(welcome.title).toBe('Welcome to Diagram');
    expect(welcome.body).toMatch(/Diagram mode/);
    expect(outro.title).toBe("You're ready to diagram");
  });

  it('has no Explorer step, and its Tab Mode step names no other mode', () => {
    expect(TOUR_STEPS.map((s) => s.id)).not.toContain('explorer');
    const mode = TOUR_STEPS.find((s) => s.id === 'editor-mode')!;
    expect(mode.title).toBe('Tab Mode');
    for (const other of ['Draw', 'Illustrate', 'Plan', 'Facilitate'])
      expect(mode.body).not.toContain(other);
  });

  it('titles every step in Title Case', () => {
    for (const step of TOUR_STEPS.filter((s) => !s.card))
      for (const word of step.title.split(' ').filter((w) => w !== '&' && w !== 'the'))
        expect(word.charAt(0)).toBe(word.charAt(0).toUpperCase());
  });
});
