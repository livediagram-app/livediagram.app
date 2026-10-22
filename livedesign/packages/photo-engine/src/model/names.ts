// A new layer's name (docs/specs/031-photo/photo-layers.md "A layer"): by kind and number ("Layer 1",
// "Levels 1", "Colour Fill 1", "Group 1"), a text layer by its first words.
import { PHOTO_LAYER_NAME_MAX } from './limits';
import type { AdjustmentId, PhotoLayer } from './types';

const ADJUSTMENT_NAMES: Record<AdjustmentId, string> = {
  brightness: 'Brightness/Contrast',
  levels: 'Levels',
  curves: 'Curves',
  exposure: 'Exposure',
  vibrance: 'Vibrance',
  'hue-saturation': 'Hue/Saturation',
  'colour-balance': 'Colour Balance',
  'white-balance': 'White Balance',
  'black-white': 'Black & White',
  'photo-filter': 'Photo Filter',
  'channel-mixer': 'Channel Mixer',
  'selective-colour': 'Selective Colour',
  'gradient-map': 'Gradient Map',
  invert: 'Invert',
  posterize: 'Posterize',
  threshold: 'Threshold',
  'shadows-highlights': 'Shadows/Highlights',
  desaturate: 'Desaturate',
  equalize: 'Equalize',
};

export function adjustmentName(id: AdjustmentId): string {
  return ADJUSTMENT_NAMES[id];
}

// The longest name a text layer takes from its words.
const TEXT_NAME_MAX = 30;

/** The stem a new layer of this kind is numbered after. */
export function layerNameStem(
  layer: Pick<PhotoLayer, 'layerKind'> & {
    adjustment?: { id: AdjustmentId };
    fill?: { kind: 'solid' | 'gradient' };
  },
): string {
  switch (layer.layerKind) {
    case 'pixel':
      return 'Layer';
    case 'group':
      return 'Group';
    case 'adjustment':
      return layer.adjustment ? adjustmentName(layer.adjustment.id) : 'Adjustment';
    case 'fill':
      return layer.fill?.kind === 'gradient' ? 'Gradient Fill' : 'Colour Fill';
    case 'text':
      return 'Text';
  }
}

/** `<stem> <n>`, n one more than the highest already used with that stem. */
export function nextLayerName(stem: string, layers: readonly Pick<PhotoLayer, 'name'>[]): string {
  let highest = 0;
  const prefix = `${stem} `;
  for (const l of layers) {
    if (!l.name.startsWith(prefix)) continue;
    const n = Number(l.name.slice(prefix.length));
    if (Number.isInteger(n) && n > highest) highest = n;
  }
  return `${stem} ${highest + 1}`.slice(0, PHOTO_LAYER_NAME_MAX);
}

/** A text layer's name: its first words, up to 30 characters, else "Text". */
export function textLayerName(text: string): string {
  const words = text.replace(/\s+/g, ' ').trim();
  if (!words) return 'Text';
  if (words.length <= TEXT_NAME_MAX) return words;
  const cut = words.slice(0, TEXT_NAME_MAX);
  const space = cut.lastIndexOf(' ');
  return (space > 10 ? cut.slice(0, space) : cut).trimEnd();
}

/** A duplicate's name. */
export function copyName(name: string): string {
  return `${name} Copy`.slice(0, PHOTO_LAYER_NAME_MAX);
}
