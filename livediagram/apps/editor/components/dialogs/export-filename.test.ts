// docs/specs/020-import-export/export-fidelity.md "File names": a tab export's name is safe on every platform and
// keeps no stray dash, as "Plan -v2-.png" did before brackets were dropped and end dashes trimmed.

import { describe, expect, it } from 'vitest';
import { sanitizeFilename } from './ExportTabDialog';

describe('sanitizeFilename', () => {
  it('drops brackets, dashes the rest and trims dashes at the ends', () => {
    expect(sanitizeFilename('Board - Plan (v2)?')).toBe('Board - Plan v2');
    expect(sanitizeFilename('a/b:c')).toBe('a-b-c');
    expect(sanitizeFilename('Roadmap [Q3]: draft')).toBe('Roadmap Q3- draft');
    expect(sanitizeFilename('a---b')).toBe('a-b');
    expect(sanitizeFilename('? - Board')).toBe('Board');
    expect(sanitizeFilename('?')).toBe('');
  });
});
