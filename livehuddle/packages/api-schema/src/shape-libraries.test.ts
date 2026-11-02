import { describe, expect, it } from 'vitest';
import {
  MAX_SHAPE_LIBRARY_ITEMS,
  MAX_SHAPE_LIBRARY_NAME_CHARS,
  normaliseLibraryName,
  shapeLibraryItemsBytes,
  uniqueLibraryName,
  validateShapeLibraryItems,
} from './shape-libraries';

// docs/specs/013-workspace/blueprints/shape-libraries.md "Interfaces and contracts".

const square = (id = 'e1') => ({
  id,
  type: 'shape',
  shape: 'square',
  x: 0,
  y: 0,
  width: 120,
  height: 60,
});
const item = (over: Record<string, unknown> = {}) => ({
  id: 'i1',
  title: 'Service',
  width: 120,
  height: 60,
  elements: [square()],
  ...over,
});

describe('uniqueLibraryName', () => {
  it('keeps a free name and suffixes a taken one with the next free number', () => {
    expect(uniqueLibraryName('UML', [])).toBe('UML');
    expect(uniqueLibraryName('UML', ['uml'])).toBe('UML (2)');
    expect(uniqueLibraryName('UML', ['UML', 'UML (2)', ' uml (3) '])).toBe('UML (4)');
  });

  it('shortens a long name so the suffixed whole fits', () => {
    const long = 'a'.repeat(MAX_SHAPE_LIBRARY_NAME_CHARS);
    const named = uniqueLibraryName(long, [long]);
    expect(named.length).toBe(MAX_SHAPE_LIBRARY_NAME_CHARS);
    expect(named.endsWith(' (2)')).toBe(true);
  });
});

describe('normaliseLibraryName', () => {
  it('trims, and refuses empty or over-long names', () => {
    expect(normaliseLibraryName('  Team icons ')).toBe('Team icons');
    expect(normaliseLibraryName('   ')).toBeNull();
    expect(normaliseLibraryName('a'.repeat(MAX_SHAPE_LIBRARY_NAME_CHARS + 1))).toBeNull();
    expect(normaliseLibraryName(42)).toBeNull();
  });
});

describe('validateShapeLibraryItems', () => {
  it('accepts valid items, migrated', () => {
    const r = validateShapeLibraryItems([item(), item({ id: 'i2', title: '' })]);
    expect(r.ok && r.items.map((i) => i.id)).toEqual(['i1', 'i2']);
  });

  it.each([
    ['not a list', { items: 'x' }, 'not-a-list'],
    ['a missing id', { items: [item({ id: '' })] }, 'invalid-item'],
    ['a long title', { items: [item({ title: 't'.repeat(201) })] }, 'invalid-item'],
    ['a zero width', { items: [item({ width: 0 })] }, 'invalid-item'],
    ['an infinite height', { items: [item({ height: Infinity })] }, 'invalid-item'],
    ['elements not a list', { items: [item({ elements: {} })] }, 'invalid-item'],
    [
      'an invalid element',
      { items: [item({ elements: [{ id: 'x', type: 'nope' }] })] },
      'invalid-element',
    ],
    ['a non-object element', { items: [item({ elements: [7] })] }, 'invalid-element'],
    ['a repeated id', { items: [item(), item()] }, 'duplicate-item-id'],
  ])('refuses %s', (_, { items }, reason) => {
    expect(validateShapeLibraryItems(items)).toEqual({ ok: false, reason });
  });

  it('refuses more than the item cap', () => {
    const many = Array.from({ length: MAX_SHAPE_LIBRARY_ITEMS + 1 }, (_, i) =>
      item({ id: `i${i}` }),
    );
    expect(validateShapeLibraryItems(many)).toEqual({ ok: false, reason: 'too-many-items' });
  });
});

describe('shapeLibraryItemsBytes', () => {
  it('is the UTF-8 length of the stored JSON', () => {
    const items = [item({ title: 'é' })];
    expect(shapeLibraryItemsBytes(items as never)).toBe(
      new TextEncoder().encode(JSON.stringify(items)).length,
    );
  });
});
