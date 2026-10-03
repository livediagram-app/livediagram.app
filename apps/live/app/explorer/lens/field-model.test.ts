import { describe, expect, it } from 'vitest';
import type { LensContext } from '@livediagram/explorer-lens';
import {
  chooseChipValue,
  composeField,
  removePill,
  settleField,
  splitField,
  writeDraft,
} from './field-model';

const aggregate: LensContext = { view: 'aggregate', teams: [{ id: 'T1', name: 'Acme' }] };
const scoped: LensContext = { view: 'scoped', teams: [] };

describe('splitField', () => {
  it('puts token words in the pills and every other word in the draft', () => {
    expect(splitField('template:kanban plan', aggregate, null)).toEqual({
      tokens: 'template:kanban',
      draft: 'plan',
      draftCaret: 4,
    });
  });

  it('reads tokens wherever they stand, text first included', () => {
    expect(splitField('plan template:kanban', aggregate, null).tokens).toBe('template:kanban');
    expect(splitField('plan template:kanban', aggregate, null).draft).toBe('plan');
  });

  it('keeps the word under the caret in the draft while it is being typed', () => {
    expect(splitField('template:kan', aggregate, 12)).toEqual({
      tokens: '',
      draft: 'template:kan',
      draftCaret: 12,
    });
  });

  it('merges every token of one dimension into one pill, values in their order', () => {
    expect(splitField('template:kanban template:retrospective', aggregate, null).tokens).toBe(
      'template:retrospective,kanban',
    );
  });

  it('keeps a token that cannot apply here as a pill', () => {
    expect(splitField('space:mine plan', scoped, null).tokens).toBe('space:mine');
  });

  it('keeps a team id in its case', () => {
    expect(splitField('space:team:T1', aggregate, null).tokens).toBe('space:team:T1');
  });

  it('maps the caret into the draft past the cut tokens', () => {
    const parts = splitField('foo template:kanban bar', aggregate, 23);
    expect(parts.draft).toBe('foo bar');
    expect(parts.draftCaret).toBe(7);
  });

  it('keeps an unknown token-shaped word as draft text', () => {
    expect(splitField('colour:red', aggregate, null)).toEqual({
      tokens: '',
      draft: 'colour:red',
      draftCaret: 10,
    });
  });
});

describe('composeField', () => {
  it('writes the pills, a space, then the draft', () => {
    expect(composeField('made-by:ai', 'plan', 2)).toEqual({ input: 'made-by:ai plan', caret: 13 });
  });

  it('puts the caret past the pills even when the draft is empty', () => {
    expect(composeField('made-by:ai', '', 0)).toEqual({ input: 'made-by:ai ', caret: 11 });
  });

  it('is the draft alone without pills', () => {
    expect(composeField('', 'plan', 4)).toEqual({ input: 'plan', caret: 4 });
  });
});

describe('writeDraft', () => {
  it('turns a token followed by a space into a pill', () => {
    expect(writeDraft('', 'template:kanban ', 16, aggregate)).toEqual({
      input: 'template:kanban ',
      caret: 16,
    });
    expect(splitField('template:kanban ', aggregate, 16)).toEqual({
      tokens: 'template:kanban',
      draft: '',
      draftCaret: 0,
    });
  });

  it('merges a typed token into the pill of its dimension', () => {
    const next = writeDraft('template:kanban', 'template:retrospective ', 23, aggregate);
    expect(next.input).toBe('template:retrospective,kanban ');
  });

  it('leaves a word still being typed in the draft', () => {
    expect(writeDraft('made-by:ai', 'edited:7', 8, aggregate)).toEqual({
      input: 'made-by:ai edited:7',
      caret: 19,
    });
  });
});

describe('settleField', () => {
  it('moves a token completed by an accepted suggestion into the pills', () => {
    expect(settleField('plan made-by:ai ', 16, aggregate)).toEqual({
      input: 'made-by:ai plan ',
      caret: 16,
    });
  });
});

describe('removePill', () => {
  it('takes every token of the dimension away and keeps the draft', () => {
    expect(removePill('template:kanban made-by:ai', 'plan', 'template', aggregate)).toBe(
      'made-by:ai plan',
    );
  });

  it('leaves the draft alone when the last pill goes', () => {
    expect(removePill('made-by:ai', 'plan', 'made-by', aggregate)).toBe('plan');
  });
});

describe('chooseChipValue', () => {
  it('adds a value to its dimension, keeping the words', () => {
    expect(chooseChipValue('template:kanban plan', 'template', 'retrospective', aggregate)).toBe(
      'template:retrospective,kanban plan',
    );
  });

  it('takes a held value away again', () => {
    expect(chooseChipValue('template:kanban plan', 'template', 'kanban', aggregate)).toBe('plan');
  });

  it('writes the first token of a dimension before the words', () => {
    expect(chooseChipValue('plan', 'made-by', 'ai', aggregate)).toBe('made-by:ai plan');
  });

  it('clears the dimension for Any', () => {
    expect(chooseChipValue('edited:7d,30d made-by:ai', 'edited', null, aggregate)).toBe(
      'made-by:ai ',
    );
  });
});
