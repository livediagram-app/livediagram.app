import { describe, expect, it } from 'vitest';
import { emptyLens, parseLens } from './parse';
import { removeTerm, serialiseLens, setDimension, tokenOf } from './serialise';
import type { LensContext } from './types';

const aggregate: LensContext = { view: 'aggregate', teams: [{ id: 'T1', name: 'Acme' }] };
const scoped: LensContext = { view: 'scoped', teams: [] };

describe('serialiseLens', () => {
  it('writes the empty lens as the empty string', () => {
    expect(serialiseLens(emptyLens())).toBe('');
  });

  it('writes tokens in dimension order, then the text words', () => {
    const { lens } = parseLens(
      'plan space:team:T1 edited:7d Q3 opens-in:draw made-by:ai',
      aggregate,
    );
    expect(serialiseLens(lens)).toBe('opens-in:draw made-by:ai edited:7d space:team:T1 plan Q3');
  });

  it('round-trips to the same canonical string', () => {
    const inputs = [
      'Board:KANBAN  plan',
      'colour:red board:kanban board:retrospective',
      'people:others x',
    ];
    for (const input of inputs) {
      const once = serialiseLens(parseLens(input, aggregate).lens);
      expect(serialiseLens(parseLens(once, aggregate).lens)).toBe(once);
    }
  });

  it('keeps a rejected word as the text it is', () => {
    expect(serialiseLens(parseLens('board:mindmap', aggregate).lens)).toBe('board:mindmap');
  });
});

describe('tokenOf', () => {
  it('writes a token', () => {
    expect(tokenOf('space', 'team:T1')).toBe('space:team:T1');
  });
});

describe('setDimension', () => {
  it('replaces the dimension token where it stands', () => {
    expect(setDimension('plan board:kanban  Q3', 'board', 'retrospective', aggregate)).toBe(
      'plan board:retrospective Q3',
    );
  });

  it('adds a token after the last token', () => {
    expect(setDimension('edited:7d plan', 'board', 'kanban', aggregate)).toBe(
      'edited:7d board:kanban plan',
    );
  });

  it('adds a token first when the string has none', () => {
    expect(setDimension('plan Q3', 'made-by', 'ai', aggregate)).toBe('made-by:ai plan Q3');
    expect(setDimension('', 'people', 'me', aggregate)).toBe('people:me');
  });

  it('removes every token of the dimension, superseded ones included, and writes one', () => {
    expect(
      setDimension('board:kanban x board:retrospective', 'board', 'event-storming', aggregate),
    ).toBe('board:event-storming x');
  });

  it('clears the dimension with null', () => {
    expect(setDimension('board:kanban plan board:retrospective', 'board', null, aggregate)).toBe(
      'plan',
    );
  });

  it('removes an inert space token too', () => {
    expect(setDimension('space:mine plan', 'space', null, scoped)).toBe('plan');
  });

  it('leaves a rejected word of the same key alone: it is text', () => {
    expect(setDimension('board:mindmap', 'board', 'kanban', aggregate)).toBe(
      'board:kanban board:mindmap',
    );
  });
});

describe('removeTerm', () => {
  it('drops the span and collapses the whitespace around it', () => {
    const input = 'plan board:kanban Q3';
    const term = parseLens(input, aggregate).terms[1]!;
    expect(removeTerm(input, term)).toBe('plan Q3');
  });

  it('drops the last word cleanly', () => {
    expect(removeTerm('plan board:kanban', { start: 5, end: 17 })).toBe('plan');
  });
});
