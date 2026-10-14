import { describe, expect, it } from 'vitest';
import { valuesOnly, writesFormats } from './values-only';

// docs/specs/013-workspace/share-roles.md "What a Participant changes": values, never formats.
describe('valuesOnly', () => {
  it('keeps the values of a cells write and drops its formats', () => {
    const write = {
      kind: 'cells' as const,
      cells: [
        { r: 'r1', c: 'c1', i: { v: 'a' }, f: { b: true } },
        { r: 'r1', c: 'c2', f: { b: true } },
        { r: 'r2', c: 'c1', i: null },
      ],
    };
    expect(writesFormats(write as never)).toBe(true);
    expect(valuesOnly(write as never)).toEqual({
      kind: 'cells',
      cells: [
        { r: 'r1', c: 'c1', i: { v: 'a' } },
        { r: 'r2', c: 'c1', i: null },
      ],
    });
  });

  it('is null for a write of formats alone, and leaves other writes as they are', () => {
    expect(
      valuesOnly({ kind: 'cells', cells: [{ r: 'r', c: 'c', f: { i: true } }] } as never),
    ).toBeNull();
    const title = { kind: 'title' as const, title: 'T' };
    expect(valuesOnly(title)).toBe(title);
    expect(writesFormats({ kind: 'cells', cells: [{ r: 'r', c: 'c', i: null }] } as never)).toBe(
      false,
    );
  });
});
