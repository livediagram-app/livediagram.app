import { describe, expect, it } from 'vitest';
import { ELEMENT_FIELD_NAMES } from '@livehuddle/document';
import { estimateTokens } from '@livehuddle/document-views';
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
    expect(text).toContain('image, freehand, path: made in the editor');
    expect(text).toContain('video, table: no longer supported in livehuddle');
  });

  // docs/specs/002-project-scope/not-in-livehuddle.md: no agent schema names the Page or a retired kind.
  it('never offers the Page or a retired kind', () => {
    for (const kind of ['page', 'agenda', 'qa-board', 'session-button', 'quiz']) {
      expect(addableKinds(), kind).not.toContain(kind);
      expect(elementFormatText(kind), kind).toBeNull();
    }
    expect(elementKindsText()).not.toMatch(/\bpage\b/);
  });

  it('keeps every kind within its budget', () => {
    for (const kind of [...addableKinds(), 'arrow'])
      expect(estimateTokens(elementFormatText(kind)!), kind).toBeLessThanOrEqual(
        SCHEMA_KIND_MAX_TOKENS,
      );
  });

  it('gives a kind its add form, first size, aliases with their values, and its own fields', () => {
    const lane = elementFormatText('lane')!;
    expect(lane).toMatch(
      /^lane: a shape\. add lane \[id=<id>\] key=value… \[<placement>\]\nSize: \d+×\d+ at first/,
    );
    expect(lane).toContain('fill=theme|');
    expect(lane).toContain('headerFill');
    expect(lane).toContain('Any other stored field by name');
    const sticky = elementFormatText('sticky')!;
    expect(sticky).toContain('fill=classic|');
    expect(sticky).not.toContain('Any other stored field');
    expect(elementFormatText('arrow')).toContain('line=straight|angled|curved');
    expect(elementFormatText('arrow')).not.toContain('Size:');
  });

  it('knows nothing of a kind the engine does not make', () => {
    expect(elementFormatText('rectangle')).toBeNull();
    expect(elementFormatText('image')).toBeNull();
    // Nor of a retired one (docs/specs/002-project-scope/not-in-livehuddle.md "Retired elements").
    expect(elementFormatText('code-block')).toBeNull();
    expect(elementFormatText('video')).toBeNull();
    expect(elementFormatText('table')).toBeNull();
  });

  it('names only stored shape fields, so the map cannot drift', () => {
    const stored = new Set<string>(ELEMENT_FIELD_NAMES.shape);
    for (const field of [...SHAPE_COMMON_FIELDS, ...Object.values(SHAPE_KIND_FIELDS).flat()])
      expect(stored.has(field), field).toBe(true);
    for (const kind of Object.keys(SHAPE_KIND_FIELDS)) expect(addableKinds()).toContain(kind);
  });

  it('teaches an add form the parser reads', () => {
    expect(parseEditOperations('add lane id=c label="x = 1"')).toHaveProperty('operations');
  });
});
