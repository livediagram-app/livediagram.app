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
  kind: null,
  template: null,
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
    expect(ids('kind')).toEqual(['dimension:kind']);
    expect(ids('t')).toEqual(['dimension:template']);
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
    expect(ids('kind:event')).toEqual(['value:kind:event-storming']);
    expect(ids('template:x')).toEqual([]);
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

  describe('comma lists', () => {
    it('matches only the entry after the last comma and keeps the earlier entries', () => {
      const [kanban] = suggestTokens('template:Retrospective,k', 24, context);
      expect(kanban).toMatchObject({
        insert: 'template:Retrospective,kanban',
        range: { start: 0, end: 24 },
      });
    });

    it('never offers a value the list already holds', () => {
      expect(ids('template:kanban,')).toEqual(['value:template:retrospective']);
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
    const [kanban] = suggestTokens('template:kxyz plan', 10, context);
    expect(kanban).toMatchObject({ insert: 'template:kanban', range: { start: 0, end: 13 } });
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
      const within = { ...context, subjects: [subject({ template: 'kanban' })] };
      const marks = suggestTokens('template:', 9, within).map((s) => [
        s.value,
        s.matchesNothing,
        s.name,
      ]);
      expect(marks).toEqual([
        ['retrospective', true, 'Retrospective, Template, no matches'],
        ['kanban', false, 'Kanban, Template'],
      ]);
    });

    it('marks a value on its own even when the list’s other values match', () => {
      const within = { ...context, subjects: [subject({ template: 'kanban' })] };
      const [retrospective] = suggestTokens('template:kanban,r', 17, within);
      expect(retrospective?.matchesNothing).toBe(true);
    });

    it('keeps every other dimension and word of the field when marking', () => {
      const within = { ...context, subjects: [subject({ name: 'Other', template: 'kanban' })] };
      expect(suggestTokens('plan template:k', 15, within)[0]?.matchesNothing).toBe(true);
      const other = { ...context, subjects: [subject({ template: 'kanban', people: 'others' })] };
      expect(suggestTokens('people:me template:k', 20, other)[0]?.matchesNothing).toBe(true);
    });

    it('drops other tokens of the same dimension when marking a value on its own', () => {
      const within = { ...context, subjects: [subject({ template: 'retrospective' })] };
      expect(suggestTokens('template:kanban template:r', 26, within)[0]?.matchesNothing).toBe(
        false,
      );
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
    expect(accept('template:k  plan', 10)).toEqual({ input: 'template:kanban plan', caret: 16 });
  });

  it('writes a value into a comma list', () => {
    expect(accept('template:retrospective,k', 24)).toEqual({
      input: 'template:retrospective,kanban ',
      caret: 30,
    });
  });

  it('leaves the rest of the field as it is', () => {
    expect(accept('a   template:k   x  template:retrospective', 14)).toEqual({
      input: 'a   template:kanban x  template:retrospective',
      caret: 20,
    });
  });
});
