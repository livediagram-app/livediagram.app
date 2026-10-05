import { describe, expect, it } from 'vitest';
import { resolveItemRef } from './refs';
import { item } from './test-items';

describe('resolveItemRef', () => {
  const a = item({ title: 'a' }, { id: 'abc123xyz', key: 12 });
  const b = item({ title: 'b' }, { id: 'abd999xyz', key: 13 });
  it('reads a key, an id and a unique prefix', () => {
    expect(resolveItemRef([a, b], '#12')).toEqual({ ok: true, item: a });
    expect(resolveItemRef([a, b], '13')).toEqual({ ok: true, item: b });
    expect(resolveItemRef([a, b], 'abd999xyz')).toEqual({ ok: true, item: b });
    expect(resolveItemRef([a, b], 'abc')).toEqual({ ok: true, item: a });
  });
  it('says when a ref names none or several', () => {
    expect(resolveItemRef([a, b], 'ab')).toMatchObject({ ok: false, reason: 'none' });
    expect(resolveItemRef([a, b], '#99')).toMatchObject({ ok: false, reason: 'none' });
    expect(resolveItemRef([a, { ...b, id: 'abc999' }], 'abc')).toMatchObject({
      ok: false,
      reason: 'ambiguous',
    });
  });
});
