// docs/specs/026-plan/plan-board.md "Suggested statuses".
import { describe, expect, it } from 'vitest';
import {
  SUGGESTED_STATUSES,
  SUGGESTED_STATUSES_MAX,
  suggestedStatuses,
  suggestionIndex,
} from './suggested-statuses';
import { statusTitleCase } from './status-title-case';

const names = (taken: Iterable<string>) => suggestedStatuses(taken).map((s) => s.name);

describe('suggestedStatuses', () => {
  it('suggests five, in the order a board runs, Done last', () => {
    expect(names([])).toEqual(['Backlog', 'To Do', 'In Progress', 'In Review', 'Done']);
    expect(SUGGESTED_STATUSES).toHaveLength(SUGGESTED_STATUSES_MAX);
  });

  it('gives each a quiet line', () => {
    for (const s of suggestedStatuses([])) expect(s.hint.length).toBeGreaterThan(0);
  });

  it('names each in Title Case, as a column is saved', () => {
    for (const s of SUGGESTED_STATUSES) expect(statusTitleCase(s.name)).toBe(s.name);
  });

  it('leaves out a name already taken, as names compare', () => {
    expect(names(['to-do', 'DONE ', 'In  progress'])).toEqual(['Backlog', 'In Review']);
  });

  it('suggests nothing once every name is taken', () => {
    expect(names(SUGGESTED_STATUSES.map((s) => s.name.toUpperCase()))).toEqual([]);
  });

  it('places a suggestion before the first later one, keeping the order a board runs', () => {
    expect(suggestionIndex([], 'Done')).toBe(0);
    expect(suggestionIndex(['To Do', 'In Progress', 'Done'], 'Backlog')).toBe(0);
    expect(suggestionIndex(['To Do', 'In Progress', 'Done'], 'in review')).toBe(2);
    // A column of the person's own does not move a suggestion: it goes before the later suggestion past it.
    expect(suggestionIndex(['To Do', 'Waiting', 'Done'], 'In Progress')).toBe(2);
    expect(suggestionIndex(['To Do', 'Waiting'], 'Done')).toBe(2);
    expect(suggestionIndex(['To Do'], 'Blocked')).toBe(1);
  });

  it('stays linear in the names taken', () => {
    const taken = Array.from({ length: 10_000 }, (_, i) => `Status ${i}`);
    const t0 = performance.now();
    for (let i = 0; i < 10; i++) expect(suggestedStatuses(taken)).toHaveLength(5);
    expect(performance.now() - t0).toBeLessThan(250);
  });

  it('reads any iterable of names, a Map’s values among them', () => {
    expect(names(new Map([['backlog~ab12', 'Backlog']]).values())).not.toContain('Backlog');
  });
});
