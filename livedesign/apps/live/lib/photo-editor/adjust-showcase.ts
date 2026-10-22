// The Adjust tab's tiles (docs/specs/031-photo/photo-adjustments.md "The Adjust tab"): each adjustment shown on the
// photo itself, so a tile shows what it does. Most adjustments start as no change, so each tile uses settings that
// show it plainly; an adjustment layer made from a tile still starts at its own defaults. The tiles' sections too.
import type { AdjustmentId } from '@livedesign/photo-engine';

// The settings each tile is drawn with (the adjustment's own defaults where those already show it).
export const ADJUST_SHOWCASE: Partial<Record<AdjustmentId, Record<string, unknown>>> = {
  brightness: { brightness: 45, contrast: 25 },
  levels: { rgb: { inBlack: 45, inWhite: 210, gamma: 1.15 } },
  curves: {
    rgb: [
      [0, 0],
      [64, 36],
      [192, 222],
      [255, 255],
    ],
  },
  exposure: { exposure: 0.9, offset: 0, gamma: 1 },
  vibrance: { vibrance: 80, saturation: 30 },
  'hue-saturation': { master: { hue: 100, saturation: 15, lightness: 0 } },
  'colour-balance': { midtones: [45, 0, -45], highlights: [20, 0, -20] },
  'white-balance': { temperature: -70, tint: 0 },
  'photo-filter': { density: 0.7 },
  'channel-mixer': { monochrome: true },
  'selective-colour': { ranges: { blues: [60, 0, -40, 0], greens: [-40, 30, 40, 0] } },
};

// The tiles' sections, in order: every adjustment a layer may take is in one.
export const ADJUST_SECTIONS: readonly { title: string; ids: readonly AdjustmentId[] }[] = [
  { title: 'Light', ids: ['brightness', 'levels', 'curves', 'exposure'] },
  {
    title: 'Colour',
    ids: [
      'vibrance',
      'hue-saturation',
      'colour-balance',
      'white-balance',
      'photo-filter',
      'selective-colour',
      'channel-mixer',
    ],
  },
  {
    title: 'Creative',
    ids: ['black-white', 'gradient-map', 'invert', 'posterize', 'threshold'],
  },
];
