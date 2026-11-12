import { describe, expect, it } from 'vitest';
import {
  ARROW_FIELDS,
  BOX_FIELDS,
  TEXT_STYLE_FIELDS,
  elementFieldLookup,
  fieldsOf,
} from './element-fields';

interface Box {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

describe('element fields', () => {
  it('hands back the names it is given, runs spread in place', () => {
    expect(fieldsOf<Box>()(['id', ...BOX_FIELDS])).toEqual(['id', 'x', 'y', 'width', 'height']);
  });

  it('keeps each run in the order the products list it', () => {
    expect(TEXT_STYLE_FIELDS).toEqual([
      'textSize',
      'textAlignX',
      'textAlignY',
      'textBold',
      'textItalic',
      'textUnderline',
      'textStrikethrough',
      'font',
    ]);
    expect(ARROW_FIELDS.slice(28, 33)).toEqual([
      'textSize',
      'textBold',
      'textItalic',
      'textUnderline',
      'textStrikethrough',
    ]);
  });

  it('looks a field up by element type, never a prototype key', () => {
    const isField = elementFieldLookup<'box' | 'dot'>({ box: ['id', ...BOX_FIELDS], dot: ['id'] });
    expect(isField('box', 'width')).toBe(true);
    expect(isField('dot', 'width')).toBe(false);
    expect(isField('box', 'toString')).toBe(false);
    expect(isField('missing' as 'box', 'id')).toBe(false);
  });
});
