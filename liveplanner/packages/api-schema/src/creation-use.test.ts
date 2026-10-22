import { describe, expect, it } from 'vitest';
import { readMarkUsed } from './creation-use';

// Making a project is a use unless the caller says otherwise (docs/specs/013-workspace/explorer-home.md
// "Making a project"; docs/specs/015-api/api.md "Marking a project used").

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
