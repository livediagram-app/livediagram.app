// Levels' and Curves' Auto (docs/specs/031-photo/photo-adjustments.md "The adjustments"): from the photo's
// histogram, Auto Tone's stretch of each channel, as Levels settings or as each channel's curve through
// its new black and white points. Pure.
import {
  autoTone,
  type CurvesParams,
  type Histogram,
  type LevelsParams,
} from '@livedesign/photo-engine';

export function autoLevels(h: Histogram): LevelsParams {
  return autoTone(h);
}

export function autoCurves(h: Histogram): CurvesParams {
  const t = autoTone(h);
  const curve = (c: 'red' | 'green' | 'blue'): [number, number][] => [
    [t[c].inBlack, 0],
    [t[c].inWhite, 255],
  ];
  return {
    rgb: [
      [0, 0],
      [255, 255],
    ],
    red: curve('red'),
    green: curve('green'),
    blue: curve('blue'),
  };
}
