// @vitest-environment node
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { checkOpticalAlignment, formatViolations } from '@liveworkspace/style-guards/optical-guard';

// A glyph in a circle or pill centres its cap band, not its line box
// (docs/specs/004-interface-design/optical-alignment.md): a chip's label goes through Chip, ButtonContent or
// text-optical-line, a disc's through GlyphDisc or text-optical-centre.
describe('optical alignment', () => {
  it('holds no bare text in a centring circle or a chip', () => {
    const root = fileURLToPath(new URL('.', import.meta.url));
    expect(formatViolations(checkOpticalAlignment({ root }))).toBe('');
  });
});
