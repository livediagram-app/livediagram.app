import { describe, expect, it } from 'vitest';
import {
  computeRefs,
  isKnownElement,
  isSlugId,
  kindWordOf,
  REF_MIN_LENGTH,
  resolveRef,
  SLUG_ID_MAX_LENGTH,
  slugIdFor,
} from './element-refs';
import { createShape, createSticky, createText } from './factories';
import type { Element } from './index';

const UUID_A = '146b2c1e-0000-4000-8000-000000000001';
const UUID_B = 'e4a81f90-0000-4000-8000-000000000002';

describe('isSlugId', () => {
  it('accepts lower-case slugs up to 24 characters', () => {
    expect(isSlugId('orders')).toBe(true);
    expect(isSlugId('a')).toBe(true);
    expect(isSlugId('redis-cache_2')).toBe(true);
    expect(isSlugId('a'.repeat(SLUG_ID_MAX_LENGTH))).toBe(true);
  });

  it('refuses digits first, capitals, spaces and over-long ids', () => {
    expect(isSlugId('2fa')).toBe(false);
    expect(isSlugId('Orders')).toBe(false);
    expect(isSlugId('orders db')).toBe(false);
    expect(isSlugId('a'.repeat(SLUG_ID_MAX_LENGTH + 1))).toBe(false);
    expect(isSlugId('')).toBe(false);
    expect(isSlugId(UUID_A)).toBe(false);
  });
});

describe('computeRefs', () => {
  it('prints a slug id as itself (R1)', () => {
    const refs = computeRefs(['orders', 'orders-db', UUID_A]);
    expect(refs.refOf('orders')).toBe('orders');
    expect(refs.refOf('orders-db')).toBe('orders-db');
  });

  it('prints the shortest unique prefix, at least 4 characters (R2)', () => {
    const refs = computeRefs([UUID_A, UUID_B]);
    expect(refs.refOf(UUID_A)).toBe('146b');
    expect(refs.refOf(UUID_B)).toBe('e4a8');
  });

  it('grows a prefix past a shared start at 4 and at 5', () => {
    const four = ['0bcd1111-x', '0bcd2222-x'];
    expect(four.map(computeRefs(four).refOf)).toEqual(['0bcd1', '0bcd2']);
    const five = ['0bcde111-x', '0bcde222-x', '9fff0000-x'];
    expect(five.map(computeRefs(five).refOf)).toEqual(['0bcde1', '0bcde2', '9fff']);
  });

  it('prints a short id whole', () => {
    const refs = computeRefs(['A1', 'A1B2C3D4']);
    expect(refs.refOf('A1')).toBe('A1');
    expect(refs.refOf('A1B2C3D4')).toBe('A1B2');
  });

  it('grows a longer id past a slug that prefixes it (E16)', () => {
    const refs = computeRefs(['abcd', 'abcd9999-X']);
    expect(refs.refOf('abcd')).toBe('abcd');
    expect(refs.refOf('abcd9999-X')).toBe('abcd9');
  });

  it('prints an unsafe prefix as id: and the full id as a JSON string (E14)', () => {
    const refs = computeRefs(['Node A', 'Node B', 'ab"cdef']);
    expect(refs.refOf('Node A')).toBe('id:"Node A"');
    expect(refs.refOf('ab"cdef')).toBe('id:"ab\\"cdef"');
  });

  it('keeps a safe prefix of an id that is unsafe further on', () => {
    expect(computeRefs(['abcd efgh']).refOf('abcd efgh')).toBe('abcd');
  });

  it('gives duplicated ids their full id', () => {
    expect(computeRefs(['abcdef', 'abcdef']).refOf('abcdef')).toBe('abcdef');
  });

  it('prints an id it was not given in the safe id: form', () => {
    expect(computeRefs([UUID_A]).refOf('gone one')).toBe('id:"gone one"');
  });

  it('never lets a ref resolve to anything but its own element (I3)', () => {
    const ids = [
      'orders',
      'orders-db',
      'ord',
      UUID_A,
      UUID_B,
      'abcd',
      'abcd9999-X',
      'Node A',
      'A1',
      'A1B2C3D4',
      '0bcd1111-x',
      '0bcd2222-x',
    ];
    const refs = computeRefs(ids);
    for (const id of ids) {
      expect(resolveRef(refs.refOf(id), refs)).toEqual({ kind: 'found', id });
    }
  });
});

describe('resolveRef', () => {
  const refs = computeRefs([UUID_A, UUID_B, 'orders', 'orders-db', '0bcd1111-x', '0bcd2222-x']);

  it('takes a ref, any unique prefix, or the full id (R3)', () => {
    expect(resolveRef('146b', refs)).toEqual({ kind: 'found', id: UUID_A });
    expect(resolveRef('14', refs)).toEqual({ kind: 'found', id: UUID_A });
    expect(resolveRef(UUID_B, refs)).toEqual({ kind: 'found', id: UUID_B });
  });

  it('matches an id:"…" ref exactly, never a longer id it prefixes', () => {
    const table = computeRefs(['n 1', 'n 10']);
    expect(resolveRef('id:"n 1"', table)).toEqual({ kind: 'found', id: 'n 1' });
    const gone = computeRefs(['n 10']);
    expect(resolveRef('id:"n 1"', gone)).toMatchObject({ kind: 'not-found', input: 'id:"n 1"' });
    expect(resolveRef('id:"n1"', computeRefs(['n10']))).toMatchObject({ kind: 'not-found' });
  });

  it('prefers the exact id over the prefix it shares', () => {
    expect(resolveRef('orders', refs)).toEqual({ kind: 'found', id: 'orders' });
  });

  it('refuses an ambiguous prefix with every candidate, never guessing (R4)', () => {
    expect(resolveRef('0b', refs)).toEqual({
      kind: 'ambiguous',
      input: '0b',
      candidates: ['0bcd1111-x', '0bcd2222-x'],
      stale: false,
    });
  });

  it('marks a printed-length prefix that now matches several as stale (R5, E17)', () => {
    const before = computeRefs(['0bcd1111-x']);
    expect(before.refOf('0bcd1111-x')).toBe('0bcd');
    const after = computeRefs(['0bcd1111-x', '0bcd2222-x']);
    expect(resolveRef('0bcd', after)).toMatchObject({ kind: 'ambiguous', stale: true });
  });

  it('answers not-found with the nearest refs by shared prefix (E18)', () => {
    expect(resolveRef('0bce', refs)).toEqual({
      kind: 'not-found',
      input: '0bce',
      nearest: ['0bcd1', '0bcd2'],
    });
    expect(resolveRef('zz', refs)).toEqual({ kind: 'not-found', input: 'zz', nearest: [] });
  });

  it('caps the nearest refs at five, closest first', () => {
    const many = computeRefs(['ab1', 'ab2', 'ab3', 'ab4', 'ab5', 'ab6', 'abx9']);
    const result = resolveRef('abx1', many);
    expect(result).toEqual({
      kind: 'not-found',
      input: 'abx1',
      nearest: ['abx9', 'ab1', 'ab2', 'ab3', 'ab4'],
    });
  });

  it('is case-sensitive', () => {
    expect(resolveRef('146B', refs)).toMatchObject({ kind: 'not-found' });
  });

  it('unquotes an id: ref', () => {
    const quoted = computeRefs(['Node A', 'Node B']);
    expect(resolveRef('id:"Node B"', quoted)).toEqual({ kind: 'found', id: 'Node B' });
    // A full id or nothing: `id:"Node"` prefixes both, and names neither.
    expect(resolveRef('id:"Node"', quoted)).toMatchObject({ kind: 'not-found' });
    expect(resolveRef('id:"broken', quoted)).toMatchObject({ kind: 'not-found' });
    expect(resolveRef('id:42', quoted)).toMatchObject({ kind: 'not-found' });
  });

  it('never matches a label (R6)', () => {
    const labelled = computeRefs(['orders', UUID_A]);
    expect(resolveRef('Orders service', labelled)).toMatchObject({ kind: 'not-found' });
  });

  it('refuses an empty input', () => {
    expect(resolveRef('', refs)).toEqual({ kind: 'not-found', input: '', nearest: [] });
  });
});

describe('slugIdFor (R7)', () => {
  it('slugs a label', () => {
    expect(slugIdFor('Redis cache', 'cylinder', new Set())).toBe('redis-cache');
    expect(slugIdFor('  Café — Crème  ', 'square', new Set())).toBe('cafe-creme');
  });

  it('adds -2, -3 on a clash', () => {
    const taken = new Set(['redis-cache', 'redis-cache-2']);
    expect(slugIdFor('Redis cache', 'cylinder', taken)).toBe('redis-cache-3');
  });

  it('falls back to the kind word for an empty slug', () => {
    expect(slugIdFor('', 'arrow', new Set())).toBe('arrow');
    expect(slugIdFor('—', 'es:actor', new Set())).toBe('es-actor');
    expect(slugIdFor('', '?', new Set())).toBe('element');
  });

  it('prefixes the kind word to a label starting with a digit', () => {
    expect(slugIdFor('2FA service', 'square', new Set())).toBe('square-2fa-service');
  });

  it('cuts at 24 characters and trims a trailing dash', () => {
    const id = slugIdFor('The quick brown fox jumps over', 'square', new Set());
    expect(id).toBe('the-quick-brown-fox-jump');
    expect(slugIdFor('abcdefghijklmnopqrstuvw xyz', 'square', new Set())).toBe(
      'abcdefghijklmnopqrstuvw',
    );
  });

  it('cuts the base to fit its suffix', () => {
    const base = 'the-quick-brown-fox-jump';
    const id = slugIdFor('The quick brown fox jumps over', 'square', new Set([base]));
    expect(id).toBe('the-quick-brown-fox-ju-2');
    const dashed = slugIdFor(
      'abcdefghijklmnopqrstu-wxyz',
      'square',
      new Set(['abcdefghijklmnopqrstu-wx']),
    );
    expect(dashed).toBe('abcdefghijklmnopqrstu-2');
  });

  it('always yields a slug id', () => {
    const labels = ['', '9', 'Ünïcødé', '日本語', 'a'.repeat(80), '-x-', 'Q&A board'];
    const taken = new Set<string>();
    for (const label of labels) {
      const id = slugIdFor(label, 'domain-event', taken);
      expect(isSlugId(id)).toBe(true);
      expect(taken.has(id)).toBe(false);
      taken.add(id);
    }
  });
});

describe('kindWordOf (R9)', () => {
  it('names a shape by its kind', () => {
    expect(kindWordOf(createShape('cylinder', 0, 0))).toBe('cylinder');
    expect(kindWordOf(createShape('frame', 0, 0))).toBe('frame');
    expect(kindWordOf(createShape('actor', 0, 0))).toBe('actor');
  });

  it('names an element by its type', () => {
    expect(kindWordOf(createText(0, 0))).toBe('text');
    expect(kindWordOf(createSticky(0, 0))).toBe('sticky');
  });

  it('names an event-storming note by its notation, es:actor apart (E28)', () => {
    expect(kindWordOf({ ...createSticky(0, 0), esKind: 'domain-event' })).toBe('domain-event');
    expect(kindWordOf({ ...createSticky(0, 0), esKind: 'actor' })).toBe('es:actor');
  });

  it('marks unknown types and shapes with ? (E12)', () => {
    const unknownShape = { ...createShape('square', 0, 0), shape: 'blob' } as unknown as Element;
    expect(kindWordOf(unknownShape)).toBe('? blob');
    const noShape = { ...createShape('square', 0, 0), shape: undefined } as unknown as Element;
    expect(kindWordOf(noShape)).toBe('? shape');
    const unknownType = { id: 'x', type: 'hologram' } as unknown as Element;
    expect(kindWordOf(unknownType)).toBe('? hologram');
    const hostile = { id: 'x', type: 'a b\nc' } as unknown as Element;
    expect(kindWordOf(hostile)).toBe('? "a b\\nc"');
  });

  it('knows exactly the types and shapes the document model knows', () => {
    expect(isKnownElement(createShape('hexagon', 0, 0))).toBe(true);
    expect(isKnownElement(createText(0, 0))).toBe(true);
    expect(
      isKnownElement({ ...createShape('square', 0, 0), shape: 'blob' } as unknown as Element),
    ).toBe(false);
    expect(isKnownElement({ id: 'x', type: 'hologram' } as unknown as Element)).toBe(false);
  });
});

describe('REF_MIN_LENGTH', () => {
  it('is four', () => {
    expect(REF_MIN_LENGTH).toBe(4);
  });
});
