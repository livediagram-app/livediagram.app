import { describe, expect, it } from 'vitest';
import { LENS_MAX_INPUT_LENGTH } from './dimensions';
import { emptyLens, normaliseInput, parseLens, readWord } from './parse';
import type { LensContext } from './types';

const aggregate: LensContext = { view: 'aggregate', teams: [{ id: 'T1', name: 'Acme' }] };
const scoped: LensContext = { view: 'scoped', teams: [{ id: 'T1', name: 'Acme' }] };

describe('parseLens', () => {
  it('reads empty and whitespace-only input as the empty lens', () => {
    expect(parseLens('', aggregate)).toEqual({ lens: emptyLens(), terms: [], issues: [] });
    expect(parseLens('  \t ', aggregate)).toEqual({ lens: emptyLens(), terms: [], issues: [] });
  });

  it('reads every dimension from its token', () => {
    const { lens, issues } = parseLens(
      'opens-in:draw board:retrospective made-by:ai edited:7d people:me space:team:T1',
      aggregate,
    );
    expect(issues).toEqual([]);
    expect(lens).toEqual({
      text: [],
      filters: {
        'opens-in': 'draw',
        board: 'retrospective',
        'made-by': 'ai',
        edited: '7d',
        people: 'me',
        space: 'team:T1',
      },
    });
  });

  it('keeps free words as text, in order, as typed', () => {
    const { lens, terms } = parseLens(' Q3  plan board:kanban Café ', aggregate);
    expect(lens.text).toEqual(['Q3', 'plan', 'Café']);
    expect(lens.filters.board).toBe('kanban');
    expect(terms.map((t) => [t.kind, t.raw, t.start, t.end])).toEqual([
      ['text', 'Q3', 1, 3],
      ['text', 'plan', 5, 9],
      ['token', 'board:kanban', 10, 22],
      ['text', 'Café', 23, 27],
    ]);
  });

  it('reads keys and fixed values without regard to case and writes them lower case', () => {
    const { lens, terms } = parseLens('Board:KANBAN SPACE:Mine', aggregate);
    expect(lens.filters.board).toBe('kanban');
    expect(lens.filters.space).toBe('mine');
    expect(terms[0]).toMatchObject({ kind: 'token', value: 'kanban', raw: 'Board:KANBAN' });
  });

  it('keeps the case of a team id and compares it exactly', () => {
    expect(parseLens('SPACE:TEAM:T1', aggregate).lens.filters.space).toBe('team:T1');
    expect(parseLens('space:team:t1', aggregate).issues).toMatchObject([
      { reason: 'unknown_team' },
    ]);
  });

  it('reads the shared space', () => {
    expect(parseLens('space:shared', aggregate).lens.filters.space).toBe('shared');
  });

  it('keeps a word that is not token-shaped as text without a report', () => {
    const { lens, issues } = parseLens('10:30 :x 3d:x', aggregate);
    expect(lens.text).toEqual(['10:30', ':x', '3d:x']);
    expect(issues).toEqual([]);
  });

  describe('rejections', () => {
    it.each([
      ['colour:red', 'unknown_dimension', null, null],
      ['http://example.com', 'unknown_dimension', null, null],
      ['board:', 'missing_value', 'board', null],
      ['space:team:', 'missing_value', 'space', null],
      ['board:mindmap', 'unknown_value', 'board', 'mindmap'],
      ['edited:week', 'unknown_value', 'edited', 'week'],
      ['space:everyone', 'unknown_value', 'space', 'everyone'],
      ['opens-in:Whiteboard', 'unknown_value', 'opens-in', 'Whiteboard'],
      ['space:team:nope', 'unknown_team', 'space', 'team:nope'],
    ])('keeps %s as text, reported as %s', (word, reason, dimension, value) => {
      const { lens, terms, issues } = parseLens(`plan ${word}`, aggregate);
      expect(lens.text).toEqual(['plan', word]);
      expect(terms[1]).toEqual({ kind: 'text', raw: word, start: 5, end: 5 + word.length });
      expect(issues).toEqual([
        { reason, raw: word, start: 5, end: 5 + word.length, dimension, value },
      ]);
    });
  });

  it('applies the last token of a dimension and reports the earlier as superseded', () => {
    const { lens, terms, issues } = parseLens(
      'board:kanban edited:today board:retrospective',
      aggregate,
    );
    expect(lens.filters.board).toBe('retrospective');
    expect(terms.map((t) => (t.kind === 'token' ? t.state : t.kind))).toEqual([
      'superseded',
      'applied',
      'applied',
    ]);
    expect(issues).toEqual([
      {
        reason: 'superseded',
        raw: 'board:kanban',
        start: 0,
        end: 12,
        dimension: 'board',
        value: 'kanban',
      },
    ]);
  });

  it('keeps a space token on a scoped view inert and reports it', () => {
    const { lens, terms, issues } = parseLens('space:mine space:shared', scoped);
    expect(lens.filters.space).toBeNull();
    expect(terms.map((t) => (t.kind === 'token' ? t.state : t.kind))).toEqual(['inert', 'inert']);
    expect(issues.map((i) => i.reason)).toEqual(['space_not_here', 'space_not_here']);
  });

  it('orders issues by where they start', () => {
    const { issues } = parseLens(
      'board:kanban colour:red board:draw board:retrospective',
      aggregate,
    );
    expect(issues.map((i) => [i.reason, i.start])).toEqual([
      ['superseded', 0],
      ['unknown_dimension', 13],
      ['unknown_value', 24],
    ]);
  });

  describe('the word being typed', () => {
    it('holds a token-shaped word with a dimension key under the caret as pending', () => {
      const input = 'plan board:kan';
      const { lens, terms, issues } = parseLens(input, aggregate, input.length);
      expect(terms[1]).toEqual({
        kind: 'pending',
        raw: 'board:kan',
        start: 5,
        end: 14,
        dimension: 'board',
      });
      expect(lens.text).toEqual(['plan']);
      expect(lens.filters.board).toBeNull();
      expect(issues).toEqual([]);
    });

    it('holds even a complete token under the caret until the caret leaves it', () => {
      expect(parseLens('board:kanban', aggregate, 3).terms[0]?.kind).toBe('pending');
      expect(parseLens('board:kanban ', aggregate, 13).lens.filters.board).toBe('kanban');
    });

    it('reads words away from the caret as usual', () => {
      expect(parseLens('board:mindmap plan', aggregate, 18).issues).toMatchObject([
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
      const input = `${head} board:kanban`;
      const { lens, issues } = parseLens(input, aggregate);
      expect(lens.text).toEqual([head]);
      expect(lens.filters.board).toBeNull();
      expect(issues).toEqual([
        {
          reason: 'too_long',
          raw: ' board:kanban',
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
      const input = 'a'.repeat(LENS_MAX_INPUT_LENGTH);
      expect(parseLens(input, aggregate).issues).toEqual([]);
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
    expect(readWord('edited:30D', aggregate)).toEqual({
      kind: 'token',
      dimension: 'edited',
      value: '30d',
    });
    expect(readWord('plan', aggregate)).toEqual({ kind: 'text', problem: null });
    expect(readWord('people:all', aggregate)).toEqual({
      kind: 'text',
      problem: { reason: 'unknown_value', dimension: 'people', value: 'all' },
    });
  });
});

describe('normaliseInput', () => {
  it('collapses whitespace and trims', () => {
    expect(normaliseInput('  plan \n\t board:kanban  ')).toBe('plan board:kanban');
  });
});
