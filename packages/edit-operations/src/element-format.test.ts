import { describe, expect, it } from 'vitest';
import { ELEMENT_FIELD_NAMES } from '@livediagram/document';
import { estimateTokens } from '@livediagram/document-views';
import {
  addableKinds,
  elementFormatText,
  elementKindsText,
  SCHEMA_KIND_MAX_TOKENS,
  SHAPE_COMMON_FIELDS,
  SHAPE_KIND_FIELDS,
} from './element-format';
import { parseEditOperations } from './parse';

describe('the element format', () => {
  it('lists every kind add makes, the arrow, and what only the editor makes', () => {
    const text = elementKindsText();
    for (const kind of addableKinds()) expect(text).toContain(kind);
    expect(text).toContain('arrow: connect <a> -> <b>');
    expect(text).toContain('image, video, freehand, path: made in the editor');
  });

  it('keeps every kind within its budget', () => {
    for (const kind of [...addableKinds(), 'arrow'])
      expect(estimateTokens(elementFormatText(kind)!), kind).toBeLessThanOrEqual(
        SCHEMA_KIND_MAX_TOKENS,
      );
  });

  it('gives a kind its add form, first size, aliases with their values, and its own fields', () => {
    const code = elementFormatText('code-block')!;
    expect(code).toMatch(
      /^code-block: a shape\. add code-block \[id=<id>\] key=value… \[<placement>\]\nSize: \d+×\d+ at first/,
    );
    expect(code).toContain('fill=theme|');
    expect(code).toContain('codeLanguage');
    expect(code).toContain('Any other stored field by name');
    const sticky = elementFormatText('sticky')!;
    expect(sticky).toContain('fill=classic|');
    expect(sticky).not.toContain('Any other stored field');
    expect(elementFormatText('arrow')).toContain('line=straight|angled|curved');
    expect(elementFormatText('arrow')).not.toContain('Size:');
  });

  it('knows nothing of a kind the engine does not make', () => {
    expect(elementFormatText('rectangle')).toBeNull();
    expect(elementFormatText('image')).toBeNull();
  });

  it('names only stored shape fields, so the map cannot drift', () => {
    const stored = new Set<string>(ELEMENT_FIELD_NAMES.shape);
    for (const field of [...SHAPE_COMMON_FIELDS, ...Object.values(SHAPE_KIND_FIELDS).flat()])
      expect(stored.has(field), field).toBe(true);
    for (const kind of Object.keys(SHAPE_KIND_FIELDS)) expect(addableKinds()).toContain(kind);
  });

  it('teaches an add form the parser reads', () => {
    expect(parseEditOperations('add code-block id=c code="x = 1"')).toHaveProperty('operations');
  });
});
