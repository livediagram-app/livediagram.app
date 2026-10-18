import { describe, expect, it } from 'vitest';
import { averageTone } from './page-image-tone';

// docs/specs/007-editor/pages-mode.md "Image backgrounds": Tone and ink.
describe('averageTone', () => {
  it('averages the pixels, weighted by their opacity', () => {
    expect(averageTone([0, 0, 0, 255, 255, 255, 255, 255])).toBe('#808080');
    expect(averageTone([255, 0, 0, 255, 0, 0, 255, 0])).toBe('#ff0000');
  });

  it('has no tone for a see-through or empty picture', () => {
    expect(averageTone([10, 20, 30, 0])).toBeNull();
    expect(averageTone([])).toBeNull();
  });
});
