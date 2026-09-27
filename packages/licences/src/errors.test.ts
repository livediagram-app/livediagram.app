import { describe, expect, it } from 'vitest';

import { LicencesError } from './errors.ts';

describe('LicencesError', () => {
  it('carries its code as its name and leads its message with it', () => {
    const error = new LicencesError('LicenceTextMissing', 'seedrandom@3.0.5 ships no licence file');
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('LicenceTextMissing');
    expect(error.code).toBe('LicenceTextMissing');
    expect(error.message).toBe('LicenceTextMissing: seedrandom@3.0.5 ships no licence file');
  });
});
