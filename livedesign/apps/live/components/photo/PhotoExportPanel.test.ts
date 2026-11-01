import { describe, expect, it } from 'vitest';
import { jpegMatte } from './PhotoExportPanel';

// docs/specs/031-photo/photo-pages.md "Exports and other views": a JPEG is "on a background of white or the
// background colour where transparent". The panel offered White or Black.
describe('a JPEG export where the photo is transparent', () => {
  it('lays it on white, or on the background colour', () => {
    expect(jpegMatte('white', '#336699')).toBe('#ffffff');
    expect(jpegMatte('background', '#336699')).toBe('#336699');
  });
});
