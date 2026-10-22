// The blend modes (docs/specs/031-photo/photo-layers.md "Blend modes"), in the Photoshop order and
// grouping, with their names. The formulas are in colour/blend.ts.
import type { BlendMode } from './types';

export const BLEND_MODE_GROUPS: readonly (readonly BlendMode[])[] = [
  ['normal', 'dissolve'],
  ['darken', 'multiply', 'colour-burn', 'linear-burn', 'darker-colour'],
  ['lighten', 'screen', 'colour-dodge', 'linear-dodge', 'lighter-colour'],
  ['overlay', 'soft-light', 'hard-light', 'vivid-light', 'linear-light', 'pin-light', 'hard-mix'],
  ['difference', 'exclusion', 'subtract', 'divide'],
  ['hue', 'saturation', 'colour', 'luminosity'],
];

/** Every mode a layer may take, a group's Pass Through last. */
export const BLEND_MODES: readonly BlendMode[] = [...BLEND_MODE_GROUPS.flat(), 'pass-through'];

export const BLEND_MODE_NAMES: Record<BlendMode, string> = {
  normal: 'Normal',
  dissolve: 'Dissolve',
  darken: 'Darken',
  multiply: 'Multiply',
  'colour-burn': 'Colour Burn',
  'linear-burn': 'Linear Burn',
  'darker-colour': 'Darker Colour',
  lighten: 'Lighten',
  screen: 'Screen',
  'colour-dodge': 'Colour Dodge',
  'linear-dodge': 'Linear Dodge (Add)',
  'lighter-colour': 'Lighter Colour',
  overlay: 'Overlay',
  'soft-light': 'Soft Light',
  'hard-light': 'Hard Light',
  'vivid-light': 'Vivid Light',
  'linear-light': 'Linear Light',
  'pin-light': 'Pin Light',
  'hard-mix': 'Hard Mix',
  difference: 'Difference',
  exclusion: 'Exclusion',
  subtract: 'Subtract',
  divide: 'Divide',
  hue: 'Hue',
  saturation: 'Saturation',
  colour: 'Colour',
  luminosity: 'Luminosity',
  'pass-through': 'Pass Through',
};

export function isBlendMode(v: unknown): v is BlendMode {
  return typeof v === 'string' && (BLEND_MODES as readonly string[]).includes(v);
}
