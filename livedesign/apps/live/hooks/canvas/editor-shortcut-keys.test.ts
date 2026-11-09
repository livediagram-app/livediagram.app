import { describe, expect, it } from 'vitest';
import { coveredKeyRole } from './editor-shortcut-keys';

describe('coveredKeyRole', () => {
  const chord = (key: string, code = '') => ({
    key,
    code,
    metaKey: true,
    ctrlKey: false,
    shiftKey: true,
    altKey: false,
  });

  it('swallows the z-order chords by key or code', () => {
    expect(coveredKeyRole(chord('}'))).toBe('swallow');
    expect(coveredKeyRole(chord('', 'BracketLeft'))).toBe('swallow');
  });

  it('leaves an empty key alone rather than reading it as a bracket', () => {
    expect(coveredKeyRole(chord(''))).toBe('ignore');
  });
});
