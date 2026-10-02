import { describe, expect, it } from 'vitest';
import { LENS_MAX_SUGGESTIONS } from './dimensions';
import { acceptSuggestion, suggestTokens } from './suggest';
import type { LensSubject, SuggestContext } from './types';

const now = new Date(2026, 5, 15, 14).getTime();

const subject = (overrides: Partial<LensSubject> = {}): LensSubject => ({
  name: 'Q3 plan',
  savedAt: now,
  space: 'mine',
  people: 'me',
  madeByAi: false,
  opensIn: 'diagram',
  board: null,
  ...overrides,
});

const context: SuggestContext = {
  view: 'aggregate',
  teams: [
    { id: 'T2', name: 'Zeta' },
    { id: 'T1', name: 'Acme' },
  ],
  subjects: [subject()],
  now,
};
const scoped: SuggestContext = { ...context, view: 'scoped' };

const ids = (input: string, caret = input.length, within: SuggestContext = context) =>
  suggestTokens(input, caret, within).map((s) => s.id);

describe('suggestTokens', () => {
  it('offers nothing for an empty word', () => {
    expect(ids('')).toEqual([]);
    expect(ids('plan ')).toEqual([]);
    expect(ids('plan', 0)).toEqual([]);
  });

  it('offers the dimensions a word starts', () => {
    expect(suggestTokens('plan op', 7, context)).toEqual([
      {
        id: 'dimension:opens-in',
        kind: 'dimension',
        dimension: 'opens-in',
        value: null,
        insert: 'opens-in:',
        range: { start: 5, end: 7 },
        label: 'Opens in',
        dimensionLabel: 'Opens in',
        name: 'Opens in',
        matchesNothing: false,
      },
    ]);
    expect(ids('MADE')).toEqual(['dimension:made-by']);
    expect(ids('board')).toEqual(['dimension:board']);
    expect(ids('e')).toEqual(['dimension:edited']);
    expect(ids('p')).toEqual(['dimension:people']);
  });

  it('offers Space only on aggregate views', () => {
    expect(ids('s')).toEqual(['dimension:space']);
    expect(ids('s', 1, scoped)).toEqual([]);
    expect(ids('space:', 6, scoped)).toEqual([]);
  });

  it('offers nothing for a word that starts no dimension, or names no dimension', () => {
    expect(ids('plan')).toEqual([]);
    expect(ids('7')).toEqual([]);
    expect(ids('colour:')).toEqual([]);
    expect(ids('opens:')).toEqual([]);
  });

  it('offers every value of a dimension, labelled, replacing the whole word', () => {
    const suggestions = suggestTokens('plan edited:', 12, context);
    expect(suggestions.map((s) => [s.insert, s.label])).toEqual([
      ['edited:today', 'Today'],
      ['edited:7d', 'Last 7 days'],
      ['edited:30d', 'Last 30 days'],
      ['edited:year', 'Last 12 months'],
    ]);
    expect(suggestions[1]).toMatchObject({
      id: 'value:edited:7d',
      kind: 'value',
      dimension: 'edited',
      value: '7d',
      range: { start: 5, end: 12 },
      dimensionLabel: 'Edited',
      name: 'Last 7 days, Edited',
    });
  });

  it('offers the values whose value or label starts with what is typed', () => {
    expect(ids('edited:LAST')).toEqual([
      'value:edited:7d',
      'value:edited:30d',
      'value:edited:year',
    ]);
    expect(ids('edited:7')).toEqual(['value:edited:7d']);
    expect(ids('board:x')).toEqual([]);
  });

  it('offers my documents, shared, then teams by name, never showing an id', () => {
    const spaces = (['mine', 'shared', 'team:T1', 'team:T2'] as const).map((space) =>
      subject({ space }),
    );
    const suggestions = suggestTokens('space:', 6, { ...context, subjects: spaces });
    expect(suggestions.map((s) => [s.insert, s.label, s.name])).toEqual([
      ['space:mine', 'My documents', 'My documents, Space'],
      ['space:shared', 'Shared with me', 'Shared with me, Space'],
      ['space:team:T1', 'Acme', 'Acme, Space'],
      ['space:team:T2', 'Zeta', 'Zeta, Space'],
    ]);
    expect(ids('space:ze')).toEqual(['value:space:team:T2']);
    expect(ids('space:team:t')).toEqual(['value:space:team:T1', 'value:space:team:T2']);
  });

  it('reads only up to the caret but replaces the whole word', () => {
    const [kanban] = suggestTokens('board:kxyz plan', 7, context);
    expect(kanban).toMatchObject({ insert: 'board:kanban', range: { start: 0, end: 10 } });
  });

  it('clamps a caret outside the input', () => {
    expect(ids('op', 99)).toEqual(['dimension:opens-in']);
    expect(ids('op', -3)).toEqual([]);
  });

  it('caps the suggestions', () => {
    const teams = Array.from({ length: 12 }, (_, i) => ({ id: `T${i}`, name: `Team ${i}` }));
    expect(suggestTokens('space:', 6, { ...context, teams })).toHaveLength(LENS_MAX_SUGGESTIONS);
  });

  describe('marking', () => {
    it('marks a value that would match nothing, and still offers it', () => {
      const within = { ...context, subjects: [subject({ board: 'kanban' })] };
      const marks = suggestTokens('board:', 6, within).map((s) => [
        s.value,
        s.matchesNothing,
        s.name,
      ]);
      expect(marks).toEqual([
        ['event-storming', true, 'Event storming, Board, no matches'],
        ['retrospective', true, 'Retrospective, Board, no matches'],
        ['kanban', false, 'Kanban, Board'],
      ]);
    });

    it('keeps every other word of the field when marking', () => {
      const within = { ...context, subjects: [subject({ name: 'Other', board: 'kanban' })] };
      expect(suggestTokens('plan board:k', 12, within)[0]?.matchesNothing).toBe(true);
    });

    it('marks against the field as accepting would leave it', () => {
      const within = { ...context, subjects: [subject({ board: 'retrospective' })] };
      const [retro] = suggestTokens('board:kanban board:r', 20, within);
      expect(retro?.matchesNothing).toBe(false);
    });

    it('marks everything when nothing is in scope', () => {
      const within = { ...context, subjects: [] };
      expect(suggestTokens('people:', 7, within).every((s) => s.matchesNothing)).toBe(true);
    });
  });
});

describe('acceptSuggestion', () => {
  const accept = (input: string, caret: number, index = 0) =>
    acceptSuggestion(input, suggestTokens(input, caret, context)[index]!, context);

  it('writes a dimension key and leaves the caret after the colon', () => {
    expect(accept('plan op', 7)).toEqual({ input: 'plan opens-in:', caret: 14 });
    expect(accept('op plan', 2)).toEqual({ input: 'opens-in: plan', caret: 9 });
  });

  it('writes a value token with one space and the caret after it', () => {
    expect(accept('plan edited:7', 13)).toEqual({ input: 'plan edited:7d ', caret: 15 });
    expect(accept('board:k plan', 7)).toEqual({ input: 'board:kanban plan', caret: 13 });
  });

  it('removes every other token of the same dimension', () => {
    expect(accept('board:kanban x board:r', 22)).toEqual({
      input: 'x board:retrospective ',
      caret: 22,
    });
  });

  it('keeps rejected words of the same key, which are text', () => {
    expect(accept('board:mindmap board:k', 21).input).toBe('board:mindmap board:kanban ');
  });

  it('collapses the spacing of the rest of the field', () => {
    expect(accept('a   board:k', 11)).toEqual({ input: 'a board:kanban ', caret: 15 });
  });
});
