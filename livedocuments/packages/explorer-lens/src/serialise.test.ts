import { describe, expect, it } from 'vitest';
import { emptyLens, parseLens } from './parse';
import {
  removeTerm,
  serialiseLens,
  setDimension,
  toggleDimensionValue,
  tokenOf,
} from './serialise';
import type { LensContext } from './types';

const aggregate: LensContext = { view: 'aggregate', teams: [{ id: 'T1', name: 'Acme' }] };
const scoped: LensContext = { view: 'scoped', teams: [] };

describe('serialiseLens', () => {
  it('writes the empty lens as the empty string', () => {
    expect(serialiseLens(emptyLens())).toBe('');
  });

  it('writes one token per dimension, in dimension order, then the text words', () => {
    const { lens } = parseLens(
      'plan space:team:T1 edited:7d Q3 opens-in:pages made-by:ai people:others',
      aggregate,
    );
    expect(serialiseLens(lens)).toBe(
      'opens-in:pages made-by:ai edited:7d people:others space:team:T1 plan Q3',
    );
  });

  it('writes several values as one comma list, whichever spelling was typed', () => {
    const repeated = parseLens('people:others people:me', aggregate).lens;
    expect(serialiseLens(repeated)).toBe('people:me,others');
    const listed = parseLens('edited:12m,TODAY,12m', aggregate).lens;
    expect(serialiseLens(listed)).toBe('edited:today,12m');
  });

  it('round-trips to the same canonical string', () => {
    const inputs = [
      'People:OTHERS  plan',
      'colour:red people:me edited:this-year,7d',
      'people:others,me x',
    ];
    for (const input of inputs) {
      const once = serialiseLens(parseLens(input, aggregate).lens);
      expect(serialiseLens(parseLens(once, aggregate).lens)).toBe(once);
    }
  });

  it('keeps a rejected word as the text it is', () => {
    expect(serialiseLens(parseLens('edited:yesterday', aggregate).lens)).toBe('edited:yesterday');
  });
});

describe('tokenOf', () => {
  it('writes a token of one or several values', () => {
    expect(tokenOf('space', ['team:T1'])).toBe('space:team:T1');
    expect(tokenOf('edited', ['today', '7d'])).toBe('edited:today,7d');
  });
});

describe('setDimension', () => {
  it('replaces the dimension token where it stands', () => {
    expect(setDimension('plan edited:7d  Q3', 'edited', ['30d'], aggregate)).toBe(
      'plan edited:30d Q3',
    );
  });

  it('writes the values in canonical order, once each', () => {
    expect(setDimension('', 'edited', ['30d', 'today', '30d'], aggregate)).toBe('edited:today,30d');
  });

  it('adds a token after the last token', () => {
    expect(setDimension('edited:7d plan', 'people', ['me'], aggregate)).toBe(
      'edited:7d people:me plan',
    );
  });

  it('adds a token first when the string has none', () => {
    expect(setDimension('plan Q3', 'made-by', ['ai'], aggregate)).toBe('made-by:ai plan Q3');
  });

  it('merges every token of the dimension into one, where the first stood', () => {
    expect(setDimension('edited:7d x edited:30d', 'edited', ['7d'], aggregate)).toBe('edited:7d x');
  });

  it('clears the dimension with no values', () => {
    expect(setDimension('edited:7d plan edited:30d', 'edited', [], aggregate)).toBe('plan');
  });

  it('removes an inert space token too', () => {
    expect(setDimension('space:mine plan', 'space', [], scoped)).toBe('plan');
  });

  it('leaves a rejected word of the same key alone: it is text', () => {
    expect(setDimension('edited:yesterday', 'edited', ['today'], aggregate)).toBe(
      'edited:today edited:yesterday',
    );
  });
});

describe('toggleDimensionValue', () => {
  it('adds a value to those the dimension already holds, across its tokens', () => {
    expect(toggleDimensionValue('people:others plan', 'people', 'me', aggregate)).toBe(
      'people:me,others plan',
    );
    expect(toggleDimensionValue('edited:7d x edited:30d', 'edited', 'today', aggregate)).toBe(
      'edited:today,7d,30d x',
    );
  });

  it('takes a value away, and the token with its last value', () => {
    expect(toggleDimensionValue('people:me,others', 'people', 'others', aggregate)).toBe(
      'people:me',
    );
    expect(toggleDimensionValue('plan made-by:ai', 'made-by', 'ai', aggregate)).toBe('plan');
  });
});

describe('removeTerm', () => {
  it('drops the span and collapses the whitespace around it', () => {
    const input = 'plan edited:7d Q3';
    const term = parseLens(input, aggregate).terms[1]!;
    expect(removeTerm(input, term)).toBe('plan Q3');
  });

  it('drops the last word cleanly', () => {
    expect(removeTerm('plan edited:today', { start: 5, end: 17 })).toBe('plan');
  });
});
