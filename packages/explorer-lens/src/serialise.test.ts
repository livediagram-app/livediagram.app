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
      'plan space:team:T1 edited:7d Q3 opens-in:draw made-by:ai kind:event-storming',
      aggregate,
    );
    expect(serialiseLens(lens)).toBe(
      'opens-in:draw kind:event-storming made-by:ai edited:7d space:team:T1 plan Q3',
    );
  });

  it('writes several values as one comma list, whichever spelling was typed', () => {
    const repeated = parseLens('template:kanban template:retrospective', aggregate).lens;
    expect(serialiseLens(repeated)).toBe('template:retrospective,kanban');
    const listed = parseLens('edited:12m,TODAY,12m', aggregate).lens;
    expect(serialiseLens(listed)).toBe('edited:today,12m');
  });

  it('round-trips to the same canonical string', () => {
    const inputs = [
      'Template:KANBAN  plan',
      'colour:red template:kanban edited:this-year,7d',
      'people:others,me x',
    ];
    for (const input of inputs) {
      const once = serialiseLens(parseLens(input, aggregate).lens);
      expect(serialiseLens(parseLens(once, aggregate).lens)).toBe(once);
    }
  });

  it('keeps a rejected word as the text it is', () => {
    expect(serialiseLens(parseLens('template:mindmap', aggregate).lens)).toBe('template:mindmap');
  });
});

describe('tokenOf', () => {
  it('writes a token of one or several values', () => {
    expect(tokenOf('space', ['team:T1'])).toBe('space:team:T1');
    expect(tokenOf('template', ['retrospective', 'kanban'])).toBe('template:retrospective,kanban');
  });
});

describe('setDimension', () => {
  it('replaces the dimension token where it stands', () => {
    expect(setDimension('plan template:kanban  Q3', 'template', ['retrospective'], aggregate)).toBe(
      'plan template:retrospective Q3',
    );
  });

  it('writes the values in canonical order, once each', () => {
    expect(setDimension('', 'edited', ['30d', 'today', '30d'], aggregate)).toBe('edited:today,30d');
  });

  it('adds a token after the last token', () => {
    expect(setDimension('edited:7d plan', 'kind', ['event-storming'], aggregate)).toBe(
      'edited:7d kind:event-storming plan',
    );
  });

  it('adds a token first when the string has none', () => {
    expect(setDimension('plan Q3', 'made-by', ['ai'], aggregate)).toBe('made-by:ai plan Q3');
  });

  it('merges every token of the dimension into one, where the first stood', () => {
    expect(
      setDimension('template:kanban x template:retrospective', 'template', ['kanban'], aggregate),
    ).toBe('template:kanban x');
  });

  it('clears the dimension with no values', () => {
    expect(
      setDimension('template:kanban plan template:retrospective', 'template', [], aggregate),
    ).toBe('plan');
  });

  it('removes an inert space token too', () => {
    expect(setDimension('space:mine plan', 'space', [], scoped)).toBe('plan');
  });

  it('leaves a rejected word of the same key alone: it is text', () => {
    expect(setDimension('template:mindmap', 'template', ['kanban'], aggregate)).toBe(
      'template:kanban template:mindmap',
    );
  });
});

describe('toggleDimensionValue', () => {
  it('adds a value to those the dimension already holds, across its tokens', () => {
    expect(
      toggleDimensionValue('template:kanban plan', 'template', 'retrospective', aggregate),
    ).toBe('template:retrospective,kanban plan');
    expect(toggleDimensionValue('edited:7d x edited:30d', 'edited', 'today', aggregate)).toBe(
      'edited:today,7d,30d x',
    );
  });

  it('takes a value away, and the token with its last value', () => {
    expect(
      toggleDimensionValue('template:retrospective,kanban', 'template', 'kanban', aggregate),
    ).toBe('template:retrospective');
    expect(toggleDimensionValue('plan made-by:ai', 'made-by', 'ai', aggregate)).toBe('plan');
  });
});

describe('removeTerm', () => {
  it('drops the span and collapses the whitespace around it', () => {
    const input = 'plan template:kanban Q3';
    const term = parseLens(input, aggregate).terms[1]!;
    expect(removeTerm(input, term)).toBe('plan Q3');
  });

  it('drops the last word cleanly', () => {
    expect(removeTerm('plan template:kanban', { start: 5, end: 20 })).toBe('plan');
  });
});
