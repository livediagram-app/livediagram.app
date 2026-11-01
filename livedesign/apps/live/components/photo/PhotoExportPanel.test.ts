import { describe, expect, it } from 'vitest';
import { formatsFor, jpegMatte } from './PhotoExportPanel';

// photo-pages.md "Exports and other views": All Sizes, while the tab has two photo pages or more.
describe('the Photo card’s formats', () => {
  it('offer All Sizes once there is more than one photo page', () => {
    expect(formatsFor(1).map((f) => f.label)).not.toContain('All Sizes');
    expect(formatsFor(2).map((f) => f.label)).toEqual([
      'PNG',
      'JPEG',
      'WebP',
      'PSD',
      'Layers as Files',
      'All Sizes',
    ]);
  });
});

// docs/specs/031-photo/photo-pages.md "Exports and other views": a JPEG is "on a background of white or the
// background colour where transparent". The panel offered White or Black.
describe('a JPEG export where the photo is transparent', () => {
  it('lays it on white, or on the background colour', () => {
    expect(jpegMatte('white', '#336699')).toBe('#ffffff');
    expect(jpegMatte('background', '#336699')).toBe('#336699');
  });
});
