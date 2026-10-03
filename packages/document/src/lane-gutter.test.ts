import { describe, expect, it } from 'vitest';
import {
  LANE_BAND_PX,
  LANE_GUTTER_PX,
  isUprightTitle,
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
