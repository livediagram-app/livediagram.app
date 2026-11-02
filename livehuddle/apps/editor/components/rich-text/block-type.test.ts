import { describe, expect, it } from 'vitest';
import {
  BLOCK_TYPES,
  blockTypeApplies,
  blockTypeLabel,
  blockTypeOf,
  listStyleOfText,
  type BlockType,
} from './block-type';

describe('blockTypeOf', () => {
  it('reports the heading level when there is no list', () => {
    expect(blockTypeOf(1, 'none')).toBe('h1');
    expect(blockTypeOf(2, 'none')).toBe('h2');
    expect(blockTypeOf(3, 'none')).toBe('h3');
  });

  it('reports paragraph for plain text', () => {
    expect(blockTypeOf(null, 'none')).toBe('paragraph');
  });

  it('reports the list style when there is one', () => {
    expect(blockTypeOf(null, 'bullet')).toBe('bullet');
    expect(blockTypeOf(null, 'numbered')).toBe('numbered');
  });

  it('lets a list win over a heading', () => {
    // The bullet is the thing you can see at the start of the line, so
    // reporting "Heading 2" for a line rendering a bullet would be the picker
    // lying about what is on screen. Reachable only through legacy runs — the
    // applies below can no longer produce this pairing.
    expect(blockTypeOf(2, 'bullet')).toBe('bullet');
    expect(blockTypeOf(1, 'numbered')).toBe('numbered');
  });
});

describe('blockTypeApplies', () => {
  it('clears the list when a heading is picked', () => {
    expect(blockTypeApplies('h1')).toEqual({ heading: 1, list: 'none' });
    expect(blockTypeApplies('h2')).toEqual({ heading: 2, list: 'none' });
    expect(blockTypeApplies('h3')).toEqual({ heading: 3, list: 'none' });
  });

  it('clears the heading when a list is picked', () => {
    expect(blockTypeApplies('bullet')).toEqual({ heading: null, list: 'bullet' });
    expect(blockTypeApplies('numbered')).toEqual({ heading: null, list: 'numbered' });
  });

  it('clears both for paragraph', () => {
    expect(blockTypeApplies('paragraph')).toEqual({ heading: null, list: 'none' });
  });

  it('round-trips every type through blockTypeOf', () => {
    // The closed-vocabulary guarantee: applying a type and reading it back
    // must give the same type, or a line can land in a state the picker
    // cannot describe.
    for (const { id } of BLOCK_TYPES) {
      const { heading, list } = blockTypeApplies(id);
      expect(blockTypeOf(heading, list), id).toBe(id);
    }
  });
});

describe('listStyleOfText', () => {
  it('reads the bullet prefix', () => {
    expect(listStyleOfText('• first')).toBe('bullet');
  });

  it('reads the numbered prefix at any number', () => {
    expect(listStyleOfText('1. first')).toBe('numbered');
    expect(listStyleOfText('12. twelfth')).toBe('numbered');
  });

  it('is none for plain text', () => {
    expect(listStyleOfText('just text')).toBe('none');
    expect(listStyleOfText('')).toBe('none');
  });

  it('does not mistake similar text for a list', () => {
    // The prefix is "N. " with the space — a decimal or a bare number is not
    // a list item.
    expect(listStyleOfText('1.5 metres')).toBe('none');
    expect(listStyleOfText('1)  first')).toBe('none');
    expect(listStyleOfText('•no space')).toBe('none');
  });

  it('reports the FIRST line only', () => {
    // The picker shows one value, and a selection spanning a bullet and a
    // paragraph has no single honest answer, so it reports where the
    // selection starts.
    expect(listStyleOfText('• first\nplain second')).toBe('bullet');
    expect(listStyleOfText('plain first\n• second')).toBe('none');
  });
});

describe('BLOCK_TYPES', () => {
  it('has a label and description for every type, with no duplicates', () => {
    const ids = BLOCK_TYPES.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const b of BLOCK_TYPES) {
      expect(b.label.length, b.id).toBeGreaterThan(0);
      expect(b.description.length, b.id).toBeGreaterThan(0);
    }
  });

  it('labels every type, and falls back to Paragraph for an unknown one', () => {
    for (const b of BLOCK_TYPES) expect(blockTypeLabel(b.id)).toBe(b.label);
    expect(blockTypeLabel('h9' as BlockType)).toBe('Paragraph');
  });
});
