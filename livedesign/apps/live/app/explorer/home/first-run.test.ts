import { describe, expect, it } from 'vitest';
import { isBlankTemplate, isTemplateKind } from '@livedesign/templates';
import { isFirstRun, welcomeSearchHref } from './first-run';
import {
  WELCOME_BLANKS,
  WELCOME_FAN,
  WELCOME_POPULAR,
  WELCOME_TEMPLATES_MAX,
  welcomeStartHref,
} from './first-run-starts';

// docs/specs/013-workspace/explorer-home.md "First run".

const none = {
  loading: false,
  failed: false,
  designs: 0,
  shared: 0,
  teamDesigns: 0,
  offlineDesigns: 0,
};

describe('isFirstRun', () => {
  it('is a first run once the lists have loaded with nothing in any of them', () => {
    expect(isFirstRun(none)).toBe(true);
  });

  it('never guesses while the lists load', () => {
    expect(isFirstRun({ ...none, loading: true })).toBe(false);
  });

  it('never takes a list that failed to load for an empty account', () => {
    expect(isFirstRun({ ...none, failed: true })).toBe(false);
  });

  it('is not a first run with anything at all: own, shared, team or this browser', () => {
    for (const key of ['designs', 'shared', 'teamDesigns', 'offlineDesigns'] as const) {
      expect(isFirstRun({ ...none, [key]: 1 }), key).toBe(false);
    }
  });
});

describe('the starts', () => {
  it("offers Pages' blank, then the first blanks of a page kind", () => {
    expect(WELCOME_BLANKS).toEqual([
      'blank-illustration',
      'blank-logo',
      'blank-wireframe-phone',
      'blank-wireframe-tablet',
      'blank-wireframe-browser',
    ]);
  });

  it('offers the first Popular templates, at most eight, none of them a blank', () => {
    expect(WELCOME_POPULAR.length).toBeGreaterThan(0);
    expect(WELCOME_POPULAR.length).toBeLessThanOrEqual(WELCOME_TEMPLATES_MAX);
    expect(WELCOME_POPULAR.some(isBlankTemplate)).toBe(false);
    expect(WELCOME_POPULAR.slice(0, 3)).toEqual([
      'logo-design',
      'wireframe-mobile-app',
      'wireframe-website',
    ]);
  });

  it('fans three real templates', () => {
    expect(WELCOME_FAN).toHaveLength(3);
    expect(WELCOME_FAN.every(isTemplateKind)).toBe(true);
  });

  it('makes a start at once through /new', () => {
    expect(welcomeStartHref('wireframe-mobile-app')).toBe('/new?template=wireframe-mobile-app');
  });

  it('opens the wizard on the searched words, or plain for none', () => {
    expect(welcomeSearchHref(' mind map ')).toBe('/new?q=mind%20map');
    expect(welcomeSearchHref('   ')).toBe('/new');
  });
});
