import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  checkOpticalAlignment,
  formatViolations,
} from '@livediagram/tailwind-config/optical-guard';

// A glyph in a circle or pill centres its cap band, not its line box
// (docs/specs/004-interface-design/optical-alignment.md): text goes through text-optical-centre or a primitive.
describe('marketing optical alignment', () => {
  it('holds no bare text in a centring circle or pill', () => {
    const root = fileURLToPath(new URL('.', import.meta.url));
    expect(formatViolations(checkOpticalAlignment({ root }))).toBe('');
  });
});
