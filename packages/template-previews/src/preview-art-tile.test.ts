import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// docs/specs/004-interface-design/forced-colors.md: a template preview is a picture of a canvas and keeps its colours
// under forced colours. Repainted, the dark re-lighting veil turned black and its darken blend wiped every preview to
// a blank box.
const css = readFileSync(new URL('./preview-art-tile.css', import.meta.url), 'utf8');

describe('preview-art-tile under forced colours', () => {
  it('keeps the tile and its veil in their own colours', () => {
    const at = css.indexOf('@media (forced-colors: active)');
    expect(at).toBeGreaterThan(-1);
    const block = css.slice(at);
    expect(block).toMatch(
      /\.preview-art-tile,\s*\.preview-art-tile::after\s*\{\s*forced-color-adjust:\s*none;/,
    );
  });
});
