import { describe, expect, it } from 'vitest';
import { previewLeftOutNote } from './preview-budget';

// The note a preview carries when the budget left pictures as placeholders, in the product's own noun.
describe('previewLeftOutNote', () => {
  it('counts the pictures and names what holds them', () => {
    expect(previewLeftOutNote(1, 'document')).toBe(
      '1 picture is drawn as a placeholder in this preview, which draws only so many pixels; the document holds them as placed, and the editor shows them.',
    );
    expect(previewLeftOutNote(3, 'design')).toBe(
      '3 pictures are drawn as a placeholder in this preview, which draws only so many pixels; the design holds them as placed, and the editor shows them.',
    );
  });
});
