import { describe, expect, it } from 'vitest';
import {
  ILLUSTRATE_TOUR_STEPS,
  illustrateTourSteps,
  illustrateTourStepTelemetryType,
} from './illustrate-tour-steps';

// docs/specs/007-editor/illustrate-tour.md "The steps"
describe('the Illustrate tour steps', () => {
  it('runs welcome, a page name and cog, add a page and Slides, then the outro', () => {
    expect(ILLUSTRATE_TOUR_STEPS.map((s) => s.id)).toEqual([
      'welcome',
      'page-name',
      'page-settings',
      'add-page',
      'slides',
      'outro',
    ]);
    expect(ILLUSTRATE_TOUR_STEPS.slice(1, -1).map((s) => s.target)).toEqual([
      'page-name',
      'page-cog',
      'add-page',
      'slides',
    ]);
  });

  it('offers itself as the Diagram tour does, and closes ready to illustrate', () => {
    expect(ILLUSTRATE_TOUR_STEPS[0]).toMatchObject({
      card: 'welcome',
      title: 'Getting started with Illustrate?',
    });
    expect(ILLUSTRATE_TOUR_STEPS.at(-1)).toMatchObject({
      card: 'outro',
      title: "You're ready to illustrate",
    });
  });

  it('keeps only the steps whose anchors are on screen, and always the bookends', () => {
    const ids = illustrateTourSteps((id) => id === 'page-cog').map((s) => s.id);
    expect(ids).toEqual(['welcome', 'page-settings', 'outro']);
  });

  it('titles every step in Title Case, with no em dash anywhere', () => {
    for (const step of ILLUSTRATE_TOUR_STEPS.filter((s) => !s.card))
      for (const word of step.title.split(' ').filter((w) => w.length > 3))
        expect(word[0], step.title).toBe(word[0]!.toUpperCase());
    for (const step of ILLUSTRATE_TOUR_STEPS) expect(`${step.title} ${step.body}`).not.toMatch(/—/);
  });

  it('names its step views', () => {
    expect(illustrateTourStepTelemetryType('page-settings')).toBe('IllustrateTourStepPageSettings');
  });
});
