import { describe, expect, it } from 'vitest';
import { at } from './art-tokens';

describe('at', () => {
  it('sets the build delay in seconds as --d', () => {
    expect(at(1.5)).toEqual({ '--d': '1.5s' });
  });

  it('carries extra custom properties alongside it', () => {
    expect(at(2, { '--dx': '12px', '--n': 3 })).toEqual({ '--d': '2s', '--dx': '12px', '--n': 3 });
  });
});
