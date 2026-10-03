import { describe, expect, it } from 'vitest';
import { LENS_MAX_INPUT_LENGTH } from './dimensions';
import { emptyLens, normaliseInput, orderValues, parseLens, readWord } from './parse';
import type { LensContext } from './types';

const aggregate: LensContext = {
  view: 'aggregate',
  teams: [
    { id: 'T1', name: 'Acme' },
    { id: 'A9', name: 'Zeta' },
  ],
};
const scoped: LensContext = { ...aggregate, view: 'scoped' };

describe('parseLens', () => {
  it('reads empty and whitespace-only input as the empty lens', () => {
    expect(parseLens('', aggregate)).toEqual({ lens: emptyLens(), terms: [], issues: [] });
    expect(parseLens('  \t ', aggregate)).toEqual({ lens: emptyLens(), terms: [], issues: [] });
  });

  it('reads every dimension from its token', () => {
    const { lens, issues } = parseLens(
      'opens-in:draw kind:event-storming template:retrospective made-by:ai edited:7d people:me space:team:T1',
      aggregate,
    );
    expect(issues).toEqual([]);
    expect(lens).toEqual({
      text: [],
      filters: {
        'opens-in': ['draw'],
        kind: ['event-storming'],
        template: ['retrospective'],
        'made-by': ['ai'],
        edited: ['7d'],
        people: ['me'],
        space: ['team:T1'],
      },
    });
  });

  it('keeps free words as text, in order, as typed', () => {
    const { lens, terms } = parseLens(' Q3  plan template:kanban Café ', aggregate);
    expect(lens.text).toEqual(['Q3', 'plan', 'Café']);
    expect(lens.filters.template).toEqual(['kanban']);
    expect(terms.map((t) => [t.kind, t.raw, t.start, t.end])).toEqual([
      ['text', 'Q3', 1, 3],
      ['text', 'plan', 5, 9],
      ['token', 'template:kanban', 10, 25],
      ['text', 'Café', 26, 30],
    ]);
  });

  it('reads keys and fixed values without regard to case and writes them lower case', () => {
    const { lens, terms } = parseLens('Template:KANBAN SPACE:Mine', aggregate);
    expect(lens.filters.template).toEqual(['kanban']);
    expect(lens.filters.space).toEqual(['mine']);
    expect(terms[0]).toMatchObject({ kind: 'token', values: ['kanban'], raw: 'Template:KANBAN' });
  });

  it('keeps the case of a team id and compares it exactly', () => {
    expect(parseLens('SPACE:TEAM:T1', aggregate).lens.filters.space).toEqual(['team:T1']);
    expect(parseLens('space:team:t1', aggregate).issues).toMatchObject([
      { reason: 'unknown_team' },
    ]);
  });

  it('keeps a word that is not token-shaped as text without a report', () => {
    const { lens, issues } = parseLens('10:30 :x 3d:x', aggregate);
    expect(lens.text).toEqual(['10:30', ':x', '3d:x']);
    expect(issues).toEqual([]);
  });

  describe('several values', () => {
    it('reads a comma list as one token of several values, in the dimension’s order', () => {
      const { lens, terms } = parseLens('template:kanban,retrospective', aggregate);
      expect(lens.filters.template).toEqual(['retrospective', 'kanban']);
      expect(terms).toEqual([
        {
          kind: 'token',
          raw: 'template:kanban,retrospective',
          start: 0,
          end: 29,
          dimension: 'template',
          values: ['retrospective', 'kanban'],
          state: 'applied',
        },
      ]);
    });

    it('joins the values of a repeated dimension, exactly as a comma list does', () => {
      const repeated = parseLens('template:kanban plan template:retrospective', aggregate).lens;
      const listed = parseLens('template:retrospective,kanban plan', aggregate).lens;
      expect(repeated).toEqual(listed);
    });

    it('counts a value listed twice once', () => {
      expect(parseLens('edited:7d,7D edited:7d', aggregate).lens.filters.edited).toEqual(['7d']);
    });

    it('orders spaces as My documents, Shared with me, then teams by id', () => {
      const { lens } = parseLens('space:team:T1,shared space:team:A9,mine', aggregate);
      expect(lens.filters.space).toEqual(['mine', 'shared', 'team:A9', 'team:T1']);
    });
  });

  describe('rejections', () => {
    it.each([
      ['colour:red', 'unknown_dimension', null, null],
      ['http://example.com', 'unknown_dimension', null, null],
      ['kind:', 'missing_value', 'kind', null],
      ['edited:7d,', 'missing_value', 'edited', null],
      ['edited:,7d', 'missing_value', 'edited', null],
      ['people:me,,others', 'missing_value', 'people', null],
      ['space:team:', 'missing_value', 'space', null],
      ['template:mindmap', 'unknown_value', 'template', 'mindmap'],
      ['template:kanban,mindmap,x', 'unknown_value', 'template', 'mindmap'],
      ['kind:diagram', 'unknown_value', 'kind', 'diagram'],
      ['board:kanban', 'unknown_dimension', null, null],
      ['edited:year', 'unknown_value', 'edited', 'year'],
      ['space:everyone', 'unknown_value', 'space', 'everyone'],
      ['opens-in:Whiteboard', 'unknown_value', 'opens-in', 'Whiteboard'],
      ['space:team:nope', 'unknown_team', 'space', 'team:nope'],
      ['space:mine,team:nope', 'unknown_team', 'space', 'team:nope'],
    ])('keeps %s as text, whole, reported as %s', (word, reason, dimension, value) => {
      const { lens, terms, issues } = parseLens(`plan ${word}`, aggregate);
      expect(lens.text).toEqual(['plan', word]);
      expect(terms[1]).toEqual({ kind: 'text', raw: word, start: 5, end: 5 + word.length });
      expect(issues).toEqual([
        { reason, raw: word, start: 5, end: 5 + word.length, dimension, value },
      ]);
    });
  });

  it('keeps a space token on a scoped view inert and reports it', () => {
    const { lens, terms, issues } = parseLens('space:mine,shared space:shared', scoped);
    expect(lens.filters.space).toEqual([]);
    expect(terms.map((t) => (t.kind === 'token' ? t.state : t.kind))).toEqual(['inert', 'inert']);
    expect(issues).toEqual([
      {
        reason: 'space_not_here',
        raw: 'space:mine,shared',
        start: 0,
        end: 17,
        dimension: 'space',
        value: 'mine,shared',
      },
      {
        reason: 'space_not_here',
        raw: 'space:shared',
        start: 18,
        end: 30,
        dimension: 'space',
        value: 'shared',
      },
    ]);
  });

  it('orders issues by where they start', () => {
    const issues = parseLens('space:team:x colour:red kind:draw', aggregate).issues;
    expect(issues.map((i) => [i.reason, i.start])).toEqual([
      ['unknown_team', 0],
      ['unknown_dimension', 13],
      ['unknown_value', 24],
    ]);
  });

  describe('the word being typed', () => {
    it('holds a token-shaped word with a dimension key under the caret as pending', () => {
      const input = 'plan template:retrospective,ka';
      const { lens, terms, issues } = parseLens(input, aggregate, input.length);
      expect(terms[1]).toEqual({
        kind: 'pending',
        raw: 'template:retrospective,ka',
        start: 5,
        end: 30,
        dimension: 'template',
      });
      expect(lens.text).toEqual(['plan']);
      expect(lens.filters.template).toEqual([]);
      expect(issues).toEqual([]);
    });

    it('holds even a complete token under the caret until the caret leaves it', () => {
      expect(parseLens('kind:event-storming', aggregate, 3).terms[0]?.kind).toBe('pending');
      expect(parseLens('kind:event-storming ', aggregate, 20).lens.filters.kind).toEqual([
        'event-storming',
      ]);
    });

    it('reads words away from the caret as usual', () => {
      expect(parseLens('template:mindmap plan', aggregate, 21).issues).toMatchObject([
        { reason: 'unknown_value' },
      ]);
    });

    it('never holds a word whose key is no dimension', () => {
      expect(parseLens('colour:', aggregate, 7).issues).toMatchObject([
        { reason: 'unknown_dimension' },
      ]);
    });
  });

  describe('over-long input', () => {
    it('cuts at the last whitespace within the limit and reports the rest', () => {
      const head = 'a'.repeat(LENS_MAX_INPUT_LENGTH - 2);
      const input = `${head} kind:event-storming`;
      const { lens, issues } = parseLens(input, aggregate);
      expect(lens.text).toEqual([head]);
      expect(lens.filters.kind).toEqual([]);
      expect(issues).toEqual([
        {
          reason: 'too_long',
          raw: ' kind:event-storming',
          start: LENS_MAX_INPUT_LENGTH - 2,
          end: input.length,
          dimension: null,
          value: null,
        },
      ]);
    });

    it('cuts one over-long word at the limit', () => {
      const input = 'a'.repeat(LENS_MAX_INPUT_LENGTH + 5);
      const { lens, issues } = parseLens(input, aggregate);
      expect(lens.text).toEqual(['a'.repeat(LENS_MAX_INPUT_LENGTH)]);
      expect(issues).toMatchObject([{ reason: 'too_long', start: LENS_MAX_INPUT_LENGTH }]);
    });

    it('keeps input of exactly the limit whole', () => {
      expect(parseLens('a'.repeat(LENS_MAX_INPUT_LENGTH), aggregate).issues).toEqual([]);
    });

    it('keeps a word that ends exactly at the limit', () => {
      const input = `${'a'.repeat(LENS_MAX_INPUT_LENGTH)} b`;
      const { lens, issues } = parseLens(input, aggregate);
      expect(lens.text).toEqual(['a'.repeat(LENS_MAX_INPUT_LENGTH)]);
      expect(issues).toMatchObject([{ reason: 'too_long', raw: ' b' }]);
    });
  });
});

describe('readWord', () => {
  it('reads a token, a text word and a rejection', () => {
    expect(readWord('edited:30D,today', aggregate)).toEqual({
      kind: 'token',
      dimension: 'edited',
      values: ['today', '30d'],
    });
    expect(readWord('plan', aggregate)).toEqual({ kind: 'text', problem: null });
    expect(readWord('people:all', aggregate)).toEqual({
      kind: 'text',
      problem: { reason: 'unknown_value', dimension: 'people', value: 'all' },
    });
  });
});

describe('orderValues', () => {
  it('deduplicates and orders a dimension’s values, dropping any outside its list', () => {
    expect(orderValues('edited', ['12m', 'today', '12m', 'nope'])).toEqual(['today', '12m']);
    expect(orderValues('space', ['team:b', 'shared', 'team:a', 'mine', 'other'])).toEqual([
      'mine',
      'shared',
      'team:a',
      'team:b',
    ]);
  });
});

describe('normaliseInput', () => {
  it('collapses whitespace and trims', () => {
    expect(normaliseInput('  plan \n\t kind:event-storming  ')).toBe('plan kind:event-storming');
  });
});
