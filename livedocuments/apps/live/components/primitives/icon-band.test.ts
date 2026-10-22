import { describe, expect, it } from 'vitest';
import {
  captionBandAlignY,
  captionBandClass,
  iconBandClass,
  iconMakesRoomForLabel,
} from './icon-band';

// The editor's CSS bands mirror iconBandBounds / iconCaptionBand in @livedocuments/document
// (docs/specs/010-palette/technology-icons.md), so a captioned icon draws as it exports.
describe('icon bands', () => {
  it('puts a middle-centre label on the glyph: both keep the whole box (issue #489)', () => {
    expect(iconBandClass('center', 'middle')).toBe('inset-0');
    expect(captionBandClass('center', 'middle')).toBe('inset-0');
    expect(captionBandAlignY('center', 'middle')).toBe('middle');
  });

  it('keeps every other alignment a caption beside the glyph', () => {
    expect(iconBandClass('center', 'bottom')).toBe('inset-x-0 top-[6%] h-[58%]');
    expect(captionBandClass('center', 'bottom')).toBe('inset-x-0 bottom-0 h-[36%]');
    expect(captionBandAlignY('center', 'bottom')).toBe('bottom');
    expect(iconBandClass('center', 'top')).toBe('inset-x-0 bottom-[6%] h-[58%]');
    expect(captionBandClass('center', 'top')).toBe('inset-x-0 top-0 h-[36%]');
    expect(captionBandAlignY('center', 'top')).toBe('top');
    // Side captions are untouched by the middle-centre rule, middle row included.
    expect(iconBandClass('left', 'middle')).toBe('left-1/2 right-[6%] inset-y-0');
    expect(captionBandClass('left', 'middle')).toBe('left-0 right-1/2 inset-y-0');
    expect(captionBandAlignY('right', 'middle')).toBe('middle');
  });
});

describe('iconMakesRoomForLabel', () => {
  it('makes room once the label has text', () => {
    expect(iconMakesRoomForLabel('EC2', false)).toBe(true);
    expect(iconMakesRoomForLabel('  ', false)).toBe(false);
    expect(iconMakesRoomForLabel(undefined, false)).toBe(false);
  });

  it('makes room from the moment the label is typed, before anything commits', () => {
    expect(iconMakesRoomForLabel(undefined, true)).toBe(true);
    expect(iconMakesRoomForLabel('', true)).toBe(true);
  });
});
