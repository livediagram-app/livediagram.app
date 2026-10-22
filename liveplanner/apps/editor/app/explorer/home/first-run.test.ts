import { describe, expect, it } from 'vitest';
import { isBlankTemplate } from '@liveplanner/templates';
import { isFirstRun, welcomeSearchHref } from './first-run';
import {
  WELCOME_BLANKS,
  WELCOME_POPULAR,
  WELCOME_TEMPLATES_MAX,
  welcomeStartHref,
} from './first-run-starts';

// docs/specs/013-workspace/explorer-home.md "First run".

const none = {
  loading: false,
  failed: false,
  projects: 0,
  shared: 0,
  teamProjects: 0,
  offlineProjects: 0,
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
    for (const key of ['projects', 'shared', 'teamProjects', 'offlineProjects'] as const) {
      expect(isFirstRun({ ...none, [key]: 1 }), key).toBe(false);
    }
  });
});

describe('the starts', () => {
  it("offers Plan's blanks", () => {
    expect(WELCOME_BLANKS).toEqual(['blank-plan', 'blank-spreadsheet', 'blank-form']);
    expect(WELCOME_BLANKS.every(isBlankTemplate)).toBe(true);
  });

  it('offers the Popular templates, none of them a blank, at most eight', () => {
    expect(WELCOME_POPULAR.length).toBeLessThanOrEqual(WELCOME_TEMPLATES_MAX);
    expect(WELCOME_POPULAR.some(isBlankTemplate)).toBe(false);
    expect(WELCOME_POPULAR.slice(0, 2)).toEqual(['project-planner', 'kanban']);
  });

  it('makes a start at once through /new', () => {
    expect(welcomeStartHref('kanban')).toBe('/new?template=kanban');
  });

  it('opens the wizard on the searched words, or plain for none', () => {
    expect(welcomeSearchHref(' mind map ')).toBe('/new?q=mind%20map');
    expect(welcomeSearchHref('   ')).toBe('/new');
  });
});
