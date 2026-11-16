import { describe, expect, it } from 'vitest';
import {
  isSuggestionId,
  mintSuggestionId,
  parseAuthor,
  parseDecision,
  parseStoredSuggestion,
  parseSuggestionOps,
  SUGGESTION_MAX_NAME,
  SUGGESTION_MAX_OPS,
  SUGGESTIONS_MAX_PER_TAB,
  targetOf,
} from './suggestion';
import { el, parseEl } from './test/fixtures';

describe('suggestion ids', () => {
  it('mints sg_ and ten base32 characters', () => {
    const id = mintSuggestionId();
    expect(isSuggestionId(id)).toBe(true);
    expect(mintSuggestionId(() => new Uint8Array(10).fill(33))).toBe('sg_bbbbbbbbbb');
  });
  it('refuses anything else', () => {
    expect(isSuggestionId('sg_ABCDEFGHIJ')).toBe(false);
    expect(isSuggestionId(7)).toBe(false);
  });
});

describe('parseAuthor', () => {
  it('trims and cuts the name and keeps a good colour', () => {
    const a = parseAuthor({ key: 'k', name: `  ${'n'.repeat(100)} `, color: '#abc' });
    expect(a).toEqual({ key: 'k', name: 'n'.repeat(SUGGESTION_MAX_NAME), color: '#abc' });
  });
  it('reads a bad colour and a missing name as the fallbacks', () => {
    expect(parseAuthor({ key: 'k', color: 'red' })).toEqual({
      key: 'k',
      name: '',
      color: '#0ea5e9',
    });
  });
  it('refuses no key, a long key or no object', () => {
    expect(parseAuthor({ name: 'x' })).toBeNull();
    expect(parseAuthor({ key: 'k'.repeat(65) })).toBeNull();
    expect(parseAuthor({ key: '' })).toBeNull();
    expect(parseAuthor(null)).toBeNull();
    expect(parseAuthor('k')).toBeNull();
  });
});

describe('parseSuggestionOps', () => {
  it('parses adds, updates and removals', () => {
    const got = parseSuggestionOps(
      [
        { kind: 'add', element: el('a'), at: 2 },
        { kind: 'add', element: el('b'), at: -1 },
        { kind: 'add', element: el('c') },
        { kind: 'update', element: el('d', 5) },
        { kind: 'remove', id: 'e' },
      ],
      parseEl,
    );
    expect(got).toEqual({
      ok: true,
      ops: [
        { kind: 'add', element: el('a'), at: 2 },
        { kind: 'add', element: el('b'), at: 0 },
        { kind: 'add', element: el('c'), at: 0 },
        { kind: 'update', element: el('d', 5) },
        { kind: 'remove', id: 'e' },
      ],
    });
  });
  it('names each refusal', () => {
    const r = (raw: unknown) => {
      const got = parseSuggestionOps(raw, parseEl);
      return got.ok ? null : got.refusal;
    };
    expect(r([])).toBe('no_ops');
    expect(r('x')).toBe('no_ops');
    expect(
      r(Array.from({ length: SUGGESTION_MAX_OPS + 1 }, () => ({ kind: 'remove', id: 'a' }))),
    ).toBe('too_many_ops');
    expect(r([null])).toBe('bad_op');
    expect(r([{ kind: 'remove', id: '' }])).toBe('bad_op');
    expect(r([{ kind: 'reorder' }])).toBe('bad_op');
    expect(r([{ kind: 'add', element: { id: 'a', type: 'nope' } }])).toBe('bad_element');
    expect(
      r([
        { kind: 'remove', id: 'a' },
        { kind: 'update', element: el('a') },
      ]),
    ).toBe('repeated_target');
  });
  it('names an op target', () => {
    expect(targetOf({ kind: 'remove', id: 'r' })).toBe('r');
    expect(targetOf({ kind: 'update', element: el('u') })).toBe('u');
  });
});

describe('parseStoredSuggestion', () => {
  const good = {
    id: 'sg_aaaaaaaaaa',
    tabId: 't1',
    author: { key: 'k', name: 'Ana', color: '#fff' },
    createdAt: 5,
    ops: [
      { kind: 'update', element: el('a') },
      { kind: 'add', element: el('b'), at: 0 },
    ],
    base: { a: 'fp', b: 3 },
    conflict: ['a', '', 4],
  };
  it('reads a stored suggestion, its base per target and its conflict', () => {
    expect(parseStoredSuggestion(JSON.stringify(good))).toEqual({
      ...good,
      base: { a: 'fp', b: null },
      conflict: ['a'],
    });
  });
  it('fills what is missing', () => {
    const { base: _b, conflict: _c, ...rest } = good;
    const got = parseStoredSuggestion(JSON.stringify({ ...rest, createdAt: 'x' }));
    expect(got).toEqual({ ...rest, createdAt: 0, base: { a: null, b: null } });
  });
  it('refuses what is not one', () => {
    expect(parseStoredSuggestion('{')).toBeNull();
    expect(parseStoredSuggestion('null')).toBeNull();
    expect(parseStoredSuggestion(JSON.stringify({ ...good, id: 'x' }))).toBeNull();
    expect(parseStoredSuggestion(JSON.stringify({ ...good, tabId: '' }))).toBeNull();
    expect(parseStoredSuggestion(JSON.stringify({ ...good, author: null }))).toBeNull();
    expect(parseStoredSuggestion(JSON.stringify({ ...good, ops: [] }))).toBeNull();
    expect(
      parseStoredSuggestion(
        JSON.stringify({ ...good, ops: [{ kind: 'add', element: { id: 'a' } }] }),
      ),
    ).toBeNull();
    expect(
      parseStoredSuggestion(JSON.stringify({ ...good, ops: [{ kind: 'add', element: 4 }] })),
    ).toBeNull();
  });
});

describe('parseDecision', () => {
  it('reads all, or the good ids once each', () => {
    expect(parseDecision({ all: true })).toEqual({ all: true });
    expect(parseDecision({ ids: ['sg_aaaaaaaaaa', 'sg_aaaaaaaaaa', 'bad'] })).toEqual({
      ids: ['sg_aaaaaaaaaa'],
    });
  });
  it('caps the ids and refuses none', () => {
    const many = Array.from({ length: 150 }, (_, i) =>
      mintSuggestionId(() => Uint8Array.from([i % 32, i >> 5, 0, 0, 0, 0, 0, 0, 0, 0])),
    );
    const got = parseDecision({ ids: many });
    expect(got && 'ids' in got ? got.ids.length : 0).toBe(SUGGESTIONS_MAX_PER_TAB);
    expect(parseDecision({ ids: ['bad'] })).toBeNull();
    expect(parseDecision({ ids: 'sg_aaaaaaaaaa' })).toBeNull();
    expect(parseDecision(null)).toBeNull();
  });
});
