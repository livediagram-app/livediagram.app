import { describe, expect, it } from 'vitest';
import { MARKED_USED_IMPORT_MAX, importMarksUse, readMarkUsed } from './creation-use';

// Making a document is a use, a bulk import is not (docs/specs/013-workspace/explorer-home.md
// "Making a document"; docs/specs/015-api/api.md "Marking a document used").

describe('readMarkUsed', () => {
  it('reads an absent field as a making that counts', () => {
    expect(readMarkUsed(undefined)).toEqual({ ok: true, markUsed: true });
  });

  it('reads a boolean as itself', () => {
    expect(readMarkUsed(true)).toEqual({ ok: true, markUsed: true });
    expect(readMarkUsed(false)).toEqual({ ok: true, markUsed: false });
  });

  it.each([null, 0, 1, 'false', 'true', {}, []])('refuses %j', (value) => {
    expect(readMarkUsed(value)).toEqual({ ok: false });
  });
});

describe('importMarksUse', () => {
  it('marks an import of one document used', () => {
    expect(importMarksUse(1)).toBe(true);
  });

  it('marks none of an import of more than one document used', () => {
    expect(importMarksUse(2)).toBe(false);
    expect(importMarksUse(40)).toBe(false);
  });

  it('draws the line at the spec\'s "more than one"', () => {
    expect(MARKED_USED_IMPORT_MAX).toBe(1);
  });
});
