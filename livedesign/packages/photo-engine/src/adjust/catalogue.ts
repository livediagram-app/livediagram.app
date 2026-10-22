// The adjustments (docs/specs/031-photo/photo-adjustments.md "The adjustments"): each reads its
// settings, says whether they leave the picture as it is, and states its change in the one form the
// CPU and the GPU both draw: a per-channel table, a luma table, a per-pixel function (baked into a
// 3D table for the GPU), or, for Shadows/Highlights alone, a neighbourhood pass.
import { adjustmentName } from '../model/names';
import type { AdjustmentId, PhotoAdjustment } from '../model/types';
import type { Raster } from '../raster/raster';
import {
  blackWhiteFn,
  channelMixerFn,
  colourBalanceFn,
  desaturateFn,
  gradientMapMap,
  hueSaturationFn,
  photoFilterFn,
  readBlackWhite,
  readChannelMixer,
  readColourBalance,
  readGradientMap,
  readHueSaturation,
  readPhotoFilter,
  readSelectiveColour,
  readVibrance,
  selectiveColourFn,
  vibranceFn,
  type PixelFn,
} from './colour-adjust';
import {
  curvesLut,
  isCurvesIdentity,
  isLevelsIdentity,
  levelsLut,
  readCurves,
  readLevels,
  type Histogram,
} from './levels';
import { applyLut, type ChannelLut } from './lut';
import { applyShadowsHighlights, readShadowsHighlights } from './shadows-highlights';
import {
  brightnessLut,
  equalizeLut,
  exposureLut,
  invertLut,
  posterizeLut,
  readBrightness,
  readExposure,
  readPosterize,
  readThreshold,
  readWhiteBalance,
  thresholdMap,
  whiteBalanceLut,
  type LumaMap,
} from './tone';

/** How an adjustment changes a pixel, in the form both renderers draw. */
export type AdjustmentForm =
  | { kind: 'identity' }
  | { kind: 'channel-lut'; lut: ChannelLut }
  | { kind: 'luma-map'; map: LumaMap }
  | { kind: 'pixel'; fn: PixelFn }
  | { kind: 'neighbourhood'; apply: (r: Raster) => void };

export type AdjustmentDef = {
  id: AdjustmentId;
  name: string;
  // Offered as an adjustment layer (all but those that read neighbours or a histogram).
  layerable: boolean;
  defaults: Record<string, unknown>;
  // Its form for these settings; `histogram` for those built from one (Equalize).
  form: (params: Record<string, unknown>, histogram?: Histogram) => AdjustmentForm;
};

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function def(
  id: AdjustmentId,
  layerable: boolean,
  defaults: Record<string, unknown>,
  form: AdjustmentDef['form'],
): AdjustmentDef {
  return { id, name: adjustmentName(id), layerable, defaults, form };
}

const lut = (l: ChannelLut): AdjustmentForm => ({ kind: 'channel-lut', lut: l });

export const ADJUSTMENTS: Record<AdjustmentId, AdjustmentDef> = {
  brightness: def('brightness', true, { brightness: 0, contrast: 0 }, (p) => {
    const v = readBrightness(p);
    return v.brightness === 0 && v.contrast === 0 ? { kind: 'identity' } : lut(brightnessLut(v));
  }),
  levels: def('levels', true, {}, (p) => {
    const v = readLevels(p);
    return isLevelsIdentity(v) ? { kind: 'identity' } : lut(levelsLut(v));
  }),
  curves: def('curves', true, {}, (p) => {
    const v = readCurves(p);
    return isCurvesIdentity(v) ? { kind: 'identity' } : lut(curvesLut(v));
  }),
  exposure: def('exposure', true, { exposure: 0, offset: 0, gamma: 1 }, (p) => {
    const v = readExposure(p);
    return v.exposure === 0 && v.offset === 0 && v.gamma === 1
      ? { kind: 'identity' }
      : lut(exposureLut(v));
  }),
  vibrance: def('vibrance', true, { vibrance: 0, saturation: 0 }, (p) => {
    const v = readVibrance(p);
    return v.vibrance === 0 && v.saturation === 0
      ? { kind: 'identity' }
      : { kind: 'pixel', fn: vibranceFn(v) };
  }),
  'hue-saturation': def('hue-saturation', true, {}, (p) => {
    const v = readHueSaturation(p);
    const zero = readHueSaturation({});
    return same(v, zero) ? { kind: 'identity' } : { kind: 'pixel', fn: hueSaturationFn(v) };
  }),
  'colour-balance': def('colour-balance', true, { preserveLuminosity: true }, (p) => {
    const v = readColourBalance(p);
    const flat = [...v.shadows, ...v.midtones, ...v.highlights].every((n) => n === 0);
    return flat ? { kind: 'identity' } : { kind: 'pixel', fn: colourBalanceFn(v) };
  }),
  'white-balance': def('white-balance', true, { temperature: 0, tint: 0 }, (p) => {
    const v = readWhiteBalance(p);
    return v.temperature === 0 && v.tint === 0 ? { kind: 'identity' } : lut(whiteBalanceLut(v));
  }),
  'black-white': def('black-white', true, {}, (p) => ({
    kind: 'pixel',
    fn: blackWhiteFn(readBlackWhite(p)),
  })),
  'photo-filter': def('photo-filter', true, {}, (p) => ({
    kind: 'pixel',
    fn: photoFilterFn(readPhotoFilter(p)),
  })),
  'channel-mixer': def('channel-mixer', true, {}, (p) => {
    const v = readChannelMixer(p);
    return !v.monochrome && same(v, readChannelMixer({}))
      ? { kind: 'identity' }
      : { kind: 'pixel', fn: channelMixerFn(v) };
  }),
  'selective-colour': def('selective-colour', true, { method: 'relative' }, (p) => {
    const v = readSelectiveColour(p);
    const flat = Object.values(v.ranges).every((inks) => inks.every((n) => n === 0));
    return flat ? { kind: 'identity' } : { kind: 'pixel', fn: selectiveColourFn(v) };
  }),
  'gradient-map': def('gradient-map', true, {}, (p) => ({
    kind: 'luma-map',
    map: gradientMapMap(readGradientMap(p)),
  })),
  invert: def('invert', true, {}, () => lut(invertLut())),
  posterize: def('posterize', true, { levels: 4 }, (p) => lut(posterizeLut(readPosterize(p)))),
  threshold: def('threshold', true, { level: 128 }, (p) => ({
    kind: 'luma-map',
    map: thresholdMap(readThreshold(p)),
  })),
  'shadows-highlights': def(
    'shadows-highlights',
    false,
    { shadows: 35, highlights: 0, radius: 30 },
    (p) => {
      const v = readShadowsHighlights(p);
      return { kind: 'neighbourhood', apply: (r) => applyShadowsHighlights(r, v) };
    },
  ),
  desaturate: def('desaturate', false, {}, () => ({ kind: 'pixel', fn: desaturateFn })),
  equalize: def('equalize', false, {}, (_p, histogram) =>
    histogram ? lut(equalizeLut(histogram.luma)) : { kind: 'identity' },
  ),
};

export const ADJUSTMENT_IDS = Object.keys(ADJUSTMENTS) as AdjustmentId[];
export const LAYER_ADJUSTMENT_IDS = ADJUSTMENT_IDS.filter((id) => ADJUSTMENTS[id].layerable);

export function adjustmentForm(a: PhotoAdjustment, histogram?: Histogram): AdjustmentForm {
  return ADJUSTMENTS[a.id].form(a.params, histogram);
}

/** Applies a form to every pixel of `r` in place (alpha kept). */
export function applyForm(r: Raster, form: AdjustmentForm): void {
  const d = r.data;
  switch (form.kind) {
    case 'identity':
      return;
    case 'channel-lut':
      applyLut(r, form.lut);
      return;
    case 'luma-map':
      for (let i = 0; i < d.length; i += 4) {
        const l = Math.round(0.299 * d[i]! + 0.587 * d[i + 1]! + 0.114 * d[i + 2]!);
        d[i] = form.map[l * 3]!;
        d[i + 1] = form.map[l * 3 + 1]!;
        d[i + 2] = form.map[l * 3 + 2]!;
      }
      return;
    case 'pixel':
      for (let i = 0; i < d.length; i += 4) {
        const [r0, g0, b0] = form.fn(d[i]! / 255, d[i + 1]! / 255, d[i + 2]! / 255);
        d[i] = r0 * 255;
        d[i + 1] = g0 * 255;
        d[i + 2] = b0 * 255;
      }
      return;
    case 'neighbourhood':
      form.apply(r);
  }
}

/** The adjustment applied to every pixel of `r` in place. */
export function applyAdjustment(r: Raster, a: PhotoAdjustment, histogram?: Histogram): void {
  applyForm(r, adjustmentForm(a, histogram));
}

/** The side of the 3D table a per-pixel adjustment is baked into for the GPU. */
export const LUT3D_SIZE = 33;

/** A per-pixel function baked into an RGB 3D table (red fastest, then green, then blue). */
export function bake3dLut(fn: PixelFn, size = LUT3D_SIZE): Uint8Array {
  const out = new Uint8Array(size * size * size * 4);
  const k = 1 / (size - 1);
  let o = 0;
  for (let b = 0; b < size; b++)
    for (let g = 0; g < size; g++)
      for (let r = 0; r < size; r++) {
        const [cr, cg, cb] = fn(r * k, g * k, b * k);
        out[o++] = Math.round(Math.min(1, Math.max(0, cr)) * 255);
        out[o++] = Math.round(Math.min(1, Math.max(0, cg)) * 255);
        out[o++] = Math.round(Math.min(1, Math.max(0, cb)) * 255);
        out[o++] = 255;
      }
  return out;
}
