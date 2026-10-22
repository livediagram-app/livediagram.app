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
  opensIn: 'pages',
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
    expect(ids('board:')).toEqual([]);
  });

  it('offers every value of a dimension, labelled, replacing the whole word', () => {
    const suggestions = suggestTokens('plan edited:', 12, context);
    expect(suggestions.map((s) => [s.insert, s.label])).toEqual([
      ['edited:today', 'Today'],
      ['edited:7d', 'Last 7 days'],
      ['edited:30d', 'Last 30 days'],
      ['edited:12m', 'Last 12 months'],
      ['edited:this-year', 'This year'],
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
    expect(ids('edited:LAST')).toEqual(['value:edited:7d', 'value:edited:30d', 'value:edited:12m']);
    expect(ids('edited:th')).toEqual(['value:edited:this-year']);
    expect(ids('people:ot')).toEqual(['value:people:others']);
    expect(ids('people:x')).toEqual([]);
  });

  it('offers my documents, shared, then teams by name, never showing an id', () => {
    const spaces = (['mine', 'shared', 'team:T1', 'team:T2'] as const).map((space) =>
      subject({ space }),
    );
    const suggestions = suggestTokens('space:', 6, { ...context, subjects: spaces });
    expect(suggestions.map((s) => [s.insert, s.label, s.name])).toEqual([
      ['space:mine', 'My Work', 'My Work, Space'],
      ['space:shared', 'Shared With Me', 'Shared With Me, Space'],
      ['space:team:T1', 'Acme', 'Acme, Space'],
      ['space:team:T2', 'Zeta', 'Zeta, Space'],
    ]);
    expect(ids('space:ze')).toEqual(['value:space:team:T2']);
    expect(ids('space:team:t')).toEqual(['value:space:team:T1', 'value:space:team:T2']);
  });

  describe('comma lists', () => {
    it('matches only the entry after the last comma and keeps the earlier entries', () => {
      const [others] = suggestTokens('people:Me,o', 11, context);
      expect(others).toMatchObject({
        insert: 'people:Me,others',
        range: { start: 0, end: 11 },
      });
    });

    it('never offers a value the list already holds', () => {
      expect(ids('people:me,')).toEqual(['value:people:others']);
      expect(ids('space:team:T1,mine,')).toEqual(['value:space:shared', 'value:space:team:T2']);
    });

    it('completes the entry under the caret and keeps the entries after it', () => {
      const input = 'edited:7d,t,30d plan';
      const suggestions = suggestTokens(input, 11, context);
      expect(suggestions.map((s) => s.insert)).toEqual([
        'edited:7d,today,30d',
        'edited:7d,this-year,30d',
      ]);
      expect(suggestions[0]?.range).toEqual({ start: 0, end: 15 });
    });

    it('drops empty entries around the one being completed', () => {
      expect(suggestTokens('people:,,o', 10, context)[0]?.insert).toBe('people:others');
    });
  });

  it('reads only up to the caret but replaces the whole word', () => {
    const [others] = suggestTokens('people:oxyz plan', 8, context);
    expect(others).toMatchObject({ insert: 'people:others', range: { start: 0, end: 11 } });
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
    it('marks a value that would match nothing on its own, and still offers it', () => {
      const within = { ...context, subjects: [subject({ people: 'others' })] };
      const marks = suggestTokens('people:', 7, within).map((s) => [
        s.value,
        s.matchesNothing,
        s.name,
      ]);
      expect(marks).toEqual([
        ['me', true, 'Me, People, no matches'],
        ['others', false, 'Others, People'],
      ]);
    });

    it('marks a value on its own even when the list’s other values match', () => {
      const within = { ...context, subjects: [subject({ people: 'others' })] };
      const [me] = suggestTokens('people:others,m', 15, within);
      expect(me?.matchesNothing).toBe(true);
    });

    it('keeps every other dimension and word of the field when marking', () => {
      const within = { ...context, subjects: [subject({ name: 'Other', people: 'others' })] };
      expect(suggestTokens('plan people:o', 13, within)[0]?.matchesNothing).toBe(true);
      const other = { ...context, subjects: [subject({ people: 'others', madeByAi: false })] };
      expect(suggestTokens('made-by:ai people:o', 19, other)[0]?.matchesNothing).toBe(true);
    });

    it('drops other tokens of the same dimension when marking a value on its own', () => {
      const within = { ...context, subjects: [subject({ people: 'me' })] };
      expect(suggestTokens('people:others people:m', 22, within)[0]?.matchesNothing).toBe(false);
    });

    it('marks everything when nothing is in scope', () => {
      const within = { ...context, subjects: [] };
      expect(suggestTokens('people:', 7, within).every((s) => s.matchesNothing)).toBe(true);
    });
  });
});

describe('acceptSuggestion', () => {
  const accept = (input: string, caret: number, index = 0) =>
    acceptSuggestion(input, suggestTokens(input, caret, context)[index]!);

  it('writes a dimension key and leaves the caret after the colon', () => {
    expect(accept('plan op', 7)).toEqual({ input: 'plan opens-in:', caret: 14 });
    expect(accept('op plan', 2)).toEqual({ input: 'opens-in: plan', caret: 9 });
  });

  it('writes a value with one space and the caret after it', () => {
    expect(accept('plan edited:7', 13)).toEqual({ input: 'plan edited:7d ', caret: 15 });
    expect(accept('people:o  plan', 8)).toEqual({ input: 'people:others plan', caret: 14 });
  });

  it('writes a value into a comma list', () => {
    expect(accept('people:me,o', 11)).toEqual({ input: 'people:me,others ', caret: 17 });
  });

  it('leaves the rest of the field as it is', () => {
    expect(accept('a   people:o   x  people:me', 12)).toEqual({
      input: 'a   people:others x  people:me',
      caret: 18,
    });
  });
});
