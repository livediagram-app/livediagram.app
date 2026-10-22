// What an adjustment's properties show (docs/specs/031-photo/photo-adjustments.md "The adjustments"):
// each adjustment's settings as fields over paths into its params, with a section chooser where the
// settings repeat per channel or range (Levels' channels, Hue/Saturation's ranges, Colour Balance's
// tones). Read through the engine's readers, so a missing value shows as its default; written back
// whole, so what is stored is always in range.
import {
  HUE_RANGES,
  PHOTO_FILTER_PRESETS,
  readBlackWhite,
  readBrightness,
  readChannelMixer,
  readColourBalance,
  readCurves,
  readExposure,
  readGradientMap,
  readHueSaturation,
  readLevels,
  readPhotoFilter,
  readPosterize,
  readSelectiveColour,
  readShadowsHighlights,
  readThreshold,
  readVibrance,
  readWhiteBalance,
  SELECTIVE_RANGES,
  type AdjustmentId,
} from '@livedesign/photo-engine';

type Path = readonly (string | number)[];

export type AdjustField =
  | {
      kind: 'number';
      path: Path;
      label: string;
      min: number;
      max: number;
      step?: number;
      unit?: string;
      percent?: boolean;
    }
  | { kind: 'toggle'; path: Path; label: string }
  | { kind: 'colour'; path: Path; label: string }
  // A gradient: its strip, opening the gradient editor.
  | { kind: 'gradient'; path: Path; label: string }
  | {
      kind: 'choice';
      path: Path;
      label: string;
      choices: readonly { value: string; label: string }[];
    };

// A chooser of which part the sectioned fields edit; each option names the path they sit under.
export type AdjustSection = { label: string; options: readonly { label: string; prefix: Path }[] };

export type AdjustSpec = {
  read: (p: unknown) => object;
  section?: AdjustSection;
  // Under the section's prefix.
  sectioned?: readonly AdjustField[];
  // At the top of the params.
  fields?: readonly AdjustField[];
  // Drawn by its own editor (Curves).
  custom?: 'curves';
};

const word = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const range = (key: string, label: string, min = -100, max = 100, unit?: string): AdjustField => ({
  kind: 'number',
  path: [key],
  label,
  min,
  max,
  ...(unit ? { unit } : {}),
});
const CHANNELS: AdjustSection = {
  label: 'Channel',
  options: [
    { label: 'RGB', prefix: ['rgb'] },
    { label: 'Red', prefix: ['red'] },
    { label: 'Green', prefix: ['green'] },
    { label: 'Blue', prefix: ['blue'] },
  ],
};

export const ADJUST_SPECS: Record<AdjustmentId, AdjustSpec> = {
  brightness: {
    read: readBrightness,
    fields: [range('brightness', 'Brightness', -150, 150), range('contrast', 'Contrast', -50, 100)],
  },
  levels: {
    read: readLevels,
    section: CHANNELS,
    sectioned: [
      range('inBlack', 'Input Black', 0, 253),
      range('inWhite', 'Input White', 2, 255),
      { kind: 'number', path: ['gamma'], label: 'Gamma', min: 0.1, max: 9.99, step: 0.01 },
      range('outBlack', 'Output Black', 0, 255),
      range('outWhite', 'Output White', 0, 255),
    ],
  },
  curves: { read: readCurves, section: CHANNELS, custom: 'curves' },
  exposure: {
    read: readExposure,
    fields: [
      { kind: 'number', path: ['exposure'], label: 'Exposure', min: -20, max: 20, step: 0.01 },
      { kind: 'number', path: ['offset'], label: 'Offset', min: -0.5, max: 0.5, step: 0.001 },
      { kind: 'number', path: ['gamma'], label: 'Gamma', min: 0.01, max: 9.99, step: 0.01 },
    ],
  },
  vibrance: {
    read: readVibrance,
    fields: [range('vibrance', 'Vibrance'), range('saturation', 'Saturation')],
  },
  'hue-saturation': {
    read: readHueSaturation,
    section: {
      label: 'Range',
      options: [
        { label: 'Master', prefix: ['master'] },
        ...HUE_RANGES.map((r) => ({ label: word(r), prefix: ['ranges', r] })),
      ],
    },
    sectioned: [
      range('hue', 'Hue', -180, 180, '°'),
      range('saturation', 'Saturation'),
      range('lightness', 'Lightness'),
    ],
    fields: [{ kind: 'toggle', path: ['colourise'], label: 'Colourise' }],
  },
  'colour-balance': {
    read: readColourBalance,
    section: {
      label: 'Tone',
      options: (['shadows', 'midtones', 'highlights'] as const).map((t) => ({
        label: word(t),
        prefix: [t],
      })),
    },
    sectioned: [
      { kind: 'number', path: [0], label: 'Cyan to Red', min: -100, max: 100 },
      { kind: 'number', path: [1], label: 'Magenta to Green', min: -100, max: 100 },
      { kind: 'number', path: [2], label: 'Yellow to Blue', min: -100, max: 100 },
    ],
    fields: [{ kind: 'toggle', path: ['preserveLuminosity'], label: 'Preserve Luminosity' }],
  },
  'white-balance': {
    read: readWhiteBalance,
    fields: [range('temperature', 'Temperature'), range('tint', 'Tint')],
  },
  'black-white': {
    read: readBlackWhite,
    fields: [
      ...(['reds', 'yellows', 'greens', 'cyans', 'blues', 'magentas'] as const).map((c) =>
        range(c, word(c), -200, 300, '%'),
      ),
      { kind: 'toggle', path: ['tint'], label: 'Tint' },
      { kind: 'colour', path: ['tintColour'], label: 'Tint Colour' },
    ],
  },
  'photo-filter': {
    read: readPhotoFilter,
    fields: [
      {
        kind: 'choice',
        path: ['colour'],
        label: 'Filter',
        choices: [
          { value: PHOTO_FILTER_PRESETS['warming-85']!, label: 'Warming Filter (85)' },
          { value: PHOTO_FILTER_PRESETS['warming-lba']!, label: 'Warming Filter (LBA)' },
          { value: PHOTO_FILTER_PRESETS['cooling-80']!, label: 'Cooling Filter (80)' },
          { value: PHOTO_FILTER_PRESETS['cooling-lbb']!, label: 'Cooling Filter (LBB)' },
          { value: PHOTO_FILTER_PRESETS.sepia!, label: 'Sepia' },
        ],
      },
      { kind: 'colour', path: ['colour'], label: 'Colour' },
      {
        kind: 'number',
        path: ['density'],
        label: 'Density',
        min: 0.01,
        max: 1,
        step: 0.01,
        percent: true,
      },
      { kind: 'toggle', path: ['preserveLuminosity'], label: 'Preserve Luminosity' },
    ],
  },
  'channel-mixer': {
    read: readChannelMixer,
    section: {
      label: 'Output Channel',
      options: [
        { label: 'Red', prefix: ['red'] },
        { label: 'Green', prefix: ['green'] },
        { label: 'Blue', prefix: ['blue'] },
        { label: 'Grey (Monochrome)', prefix: ['grey'] },
      ],
    },
    sectioned: [
      { kind: 'number', path: [0], label: 'Red', min: -200, max: 200, unit: '%' },
      { kind: 'number', path: [1], label: 'Green', min: -200, max: 200, unit: '%' },
      { kind: 'number', path: [2], label: 'Blue', min: -200, max: 200, unit: '%' },
      { kind: 'number', path: [3], label: 'Constant', min: -200, max: 200, unit: '%' },
    ],
    fields: [{ kind: 'toggle', path: ['monochrome'], label: 'Monochrome' }],
  },
  'selective-colour': {
    read: readSelectiveColour,
    section: {
      label: 'Colours',
      options: SELECTIVE_RANGES.map((r) => ({ label: word(r), prefix: ['ranges', r] })),
    },
    sectioned: ['Cyan', 'Magenta', 'Yellow', 'Black'].map((label, i) => ({
      kind: 'number' as const,
      path: [i],
      label,
      min: -100,
      max: 100,
      unit: '%',
    })),
    fields: [{ kind: 'toggle', path: ['relative'], label: 'Relative' }],
  },
  'gradient-map': {
    read: readGradientMap,
    fields: [
      { kind: 'gradient', path: ['gradient'], label: 'Gradient' },
      { kind: 'toggle', path: ['reverse'], label: 'Reverse' },
      { kind: 'toggle', path: ['dither'], label: 'Dither' },
    ],
  },
  invert: { read: () => ({}) },
  posterize: { read: readPosterize, fields: [range('levels', 'Levels', 2, 255)] },
  threshold: { read: readThreshold, fields: [range('level', 'Level', 1, 255)] },
  'shadows-highlights': {
    read: readShadowsHighlights,
    fields: [
      range('shadows', 'Shadows', 0, 100, '%'),
      range('highlights', 'Highlights', 0, 100, '%'),
      range('radius', 'Radius', 0, 250, 'px'),
    ],
  },
  desaturate: { read: () => ({}) },
  equalize: { read: () => ({}) },
};

export function getPath(o: unknown, path: Path): unknown {
  let at: unknown = o;
  for (const k of path) {
    if (at === null || typeof at !== 'object') return undefined;
    at = (at as Record<string | number, unknown>)[k];
  }
  return at;
}

/** `o` with the value at `path` replaced (arrays kept arrays). */
export function setPath<T>(o: T, path: Path, value: unknown): T {
  if (!path.length) return value as T;
  const [k, ...rest] = path;
  const base = (o ?? (typeof k === 'number' ? [] : {})) as Record<string | number, unknown>;
  const copy = (Array.isArray(base) ? [...base] : { ...base }) as Record<string | number, unknown>;
  copy[k!] = setPath(base[k!], rest, value);
  return copy as T;
}

/** The adjustment's params, read in range, with one value changed. */
export function withSetting(
  id: AdjustmentId,
  params: unknown,
  path: Path,
  value: unknown,
): Record<string, unknown> {
  return setPath(ADJUST_SPECS[id].read(params), path, value) as Record<string, unknown>;
}
