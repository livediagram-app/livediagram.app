// PSD's four-character blend mode keys, each to and from the engine's blend modes.
import type { BlendMode } from '../model/types';

export const BLEND_KEYS: Record<BlendMode, string> = {
  normal: 'norm',
  dissolve: 'diss',
  darken: 'dark',
  multiply: 'mul ',
  'colour-burn': 'idiv',
  'linear-burn': 'lbrn',
  'darker-colour': 'dkCl',
  lighten: 'lite',
  screen: 'scrn',
  'colour-dodge': 'div ',
  'linear-dodge': 'lddg',
  'lighter-colour': 'lgCl',
  overlay: 'over',
  'soft-light': 'sLit',
  'hard-light': 'hLit',
  'vivid-light': 'vLit',
  'linear-light': 'lLit',
  'pin-light': 'pLit',
  'hard-mix': 'hMix',
  difference: 'diff',
  exclusion: 'smud',
  subtract: 'fsub',
  divide: 'fdiv',
  hue: 'hue ',
  saturation: 'sat ',
  colour: 'colr',
  luminosity: 'lum ',
  'pass-through': 'pass',
};

const BY_KEY = new Map(Object.entries(BLEND_KEYS).map(([mode, key]) => [key, mode as BlendMode]));

/** The blend mode for a key; an unknown one is Normal. */
export function blendFromKey(key: string): BlendMode {
  return BY_KEY.get(key) ?? 'normal';
}
