import { describe, expect, it } from 'vitest';
import {
  LANE_BAND_PX,
  LANE_GUTTER_PX,
  LANE_TITLE_MAX_LINES,
  acrossTitlePadding,
  acrossTitleStrip,
  isUprightTitle,
  laneDrawnSize,
  laneSizeOfElement,
  uprightTitleStrip,
} from './lane-gutter';

// Upright titles (docs/specs/009-elements/lane.md "Upright titles"): a side strip's title turned a
// quarter, in a strip one line thick.
describe('isUprightTitle', () => {
  it('turns a side strip whose lane asks for it', () => {
    for (const textAlignX of ['left', 'right'] as const) {
      expect(isUprightTitle({ titleOrientation: 'upright', textAlignX })).toBe(true);
    }
    expect(isUprightTitle({ titleOrientation: 'upright', textAlignX: 'center' })).toBe(true);
  });

  it('never turns a band across the top or bottom', () => {
    for (const textAlignY of ['top', 'bottom'] as const) {
      expect(
        isUprightTitle({ titleOrientation: 'upright', textAlignX: 'center', textAlignY }),
      ).toBe(false);
    }
  });

  it('reads across when the lane does not ask', () => {
    expect(isUprightTitle({ textAlignX: 'left' })).toBe(false);
  });
});

describe('laneSizeOfElement', () => {
  it('gives an upright strip the one-line band thickness by default', () => {
    expect(laneSizeOfElement({ titleOrientation: 'upright', textAlignX: 'left' })).toBe(
      LANE_BAND_PX,
    );
    expect(laneSizeOfElement({ textAlignX: 'left' })).toBe(LANE_GUTTER_PX);
    expect(
      laneSizeOfElement({ titleOrientation: 'upright', textAlignX: 'left', headerSize: 40 }),
    ).toBe(40);
  });
});

describe('uprightTitleStrip', () => {
  it('places the strip on its side and reads the vertical pin along it', () => {
    expect(
      uprightTitleStrip(
        { titleOrientation: 'upright', textAlignX: 'left', textAlignY: 'top' },
        900,
        200,
      ),
    ).toEqual({ x: 0, y: 0, width: LANE_BAND_PX, height: 200, alongAlign: 'right' });
    expect(
      uprightTitleStrip(
        { titleOrientation: 'upright', textAlignX: 'right', textAlignY: 'bottom', headerSize: 40 },
        900,
        200,
      ),
    ).toEqual({ x: 860, y: 0, width: 40, height: 200, alongAlign: 'left' });
    expect(
      uprightTitleStrip({ titleOrientation: 'upright', textAlignX: 'center' }, 900, 200),
    ).toEqual({ x: 418, y: 0, width: LANE_BAND_PX, height: 200, alongAlign: 'center' });
  });
});

// The strip a lane draws (docs/specs/009-elements/lane.md): its heading, held short of its span.
describe('laneDrawnSize', () => {
  it('draws the heading at its size when the lane has room', () => {
    expect(laneDrawnSize({ textAlignX: 'left', headerSize: 150 }, 600, 200)).toBe(150);
  });

  it('holds a side heading a pixel short of a lane narrower than it', () => {
    expect(laneDrawnSize({ textAlignX: 'left', headerSize: 150 }, 100, 200)).toBe(99);
  });

  it('measures a band against the lane height', () => {
    expect(laneDrawnSize({ textAlignY: 'top', headerSize: 90 }, 600, 50)).toBe(49);
  });
});

// docs/specs/009-elements/lane.md "A title wraps in its gutter" (Work Tracker 444).
describe('acrossTitleStrip', () => {
  it('lays an across title out in its side strip, on whichever side the gutter hugs', () => {
    expect(acrossTitleStrip({ textAlignX: 'left' }, 900, 200)).toEqual({
      x: 0,
      y: 0,
      width: LANE_GUTTER_PX,
      height: 200,
    });
    expect(acrossTitleStrip({ textAlignX: 'right', headerSize: 100 }, 900, 200)).toEqual({
      x: 800,
      y: 0,
      width: 100,
      height: 200,
    });
    expect(acrossTitleStrip({ textAlignX: 'center', textAlignY: 'middle' }, 900, 200)).toEqual({
      x: 384,
      y: 0,
      width: LANE_GUTTER_PX,
      height: 200,
    });
    // A gutter wider than the lane is held to it.
    expect(acrossTitleStrip({ textAlignX: 'left', headerSize: 500 }, 300, 200)?.width).toBe(300);
  });

  it('has no strip for a band or an upright title', () => {
    expect(acrossTitleStrip({ textAlignX: 'center', textAlignY: 'top' }, 900, 200)).toBeNull();
    expect(acrossTitleStrip({ textAlignX: 'center', textAlignY: 'bottom' }, 900, 200)).toBeNull();
    expect(
      acrossTitleStrip({ textAlignX: 'left', titleOrientation: 'upright' }, 900, 200),
    ).toBeNull();
  });

  it('wraps onto at most three lines', () => {
    expect(LANE_TITLE_MAX_LINES).toBe(3);
  });
});

describe('acrossTitlePadding', () => {
  it('keeps at most the small padding across the strip, so the gutter goes to the words', () => {
    expect(acrossTitlePadding(24)).toBe(6);
    expect(acrossTitlePadding(14)).toBe(6);
    expect(acrossTitlePadding(0)).toBe(0);
  });
});
