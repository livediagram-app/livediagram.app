import { describe, expect, it } from 'vitest';
import { isUntitledName, UNTITLED_DOCUMENT_NAMES } from './untitled-names';

describe('isUntitledName', () => {
  it('accepts every mode blank default', () => {
    for (const name of UNTITLED_DOCUMENT_NAMES) expect(isUntitledName(name)).toBe(true);
    for (const n of [
      'Untitled Whiteboard',
      'Untitled Session',
      'Untitled Illustration',
      'Untitled Plan',
    ]) {
      expect(isUntitledName(n)).toBe(true);
    }
  });

  it('refuses a name someone gave and a template pick', () => {
    expect(isUntitledName('Roadmap')).toBe(false);
    expect(isUntitledName('Untitled Tree Mind Map')).toBe(false);
    expect(isUntitledName('')).toBe(false);
  });
});
