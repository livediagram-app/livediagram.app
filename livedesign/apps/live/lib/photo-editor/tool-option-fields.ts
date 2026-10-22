// What the options flyout shows for each tool (docs/specs/031-photo/photo-tools.md names each tool's
// options): a declarative list of each options group's fields, so one bar draws them all. A field may
// be one tool's only (Protect Detail is the Sharpen tool's) with `only`.
import { FONTS } from '@livedesign/document';
import { BLEND_MODE_GROUPS, BLEND_MODE_NAMES, type BlendMode } from '@livedesign/photo-engine';
import type { PhotoToolId, SelectMode, ToolOptions } from './tool-state';

export type OptionField =
  | {
      kind: 'slider';
      key: string;
      label: string;
      min: number;
      max: number;
      step?: number;
      unit?: string;
      // A 0 to 1 option read out as a percent.
      percent?: boolean;
      only?: readonly PhotoToolId[];
    }
  | { kind: 'toggle'; key: string; label: string; only?: readonly PhotoToolId[] }
  // A gradient: its strip, opening the gradient editor.
  | { kind: 'gradient'; key: string; label: string; only?: readonly PhotoToolId[] }
  | {
      kind: 'choice';
      key: string;
      label: string;
      choices: readonly { value: string | number; label: string }[];
      only?: readonly PhotoToolId[];
    };

const BLENDS = BLEND_MODE_GROUPS.flat().map((m: BlendMode) => ({
  value: m,
  label: BLEND_MODE_NAMES[m],
}));

const size = (max = 2500): OptionField => ({
  kind: 'slider',
  key: 'size',
  label: 'Size',
  min: 1,
  max,
  unit: 'px',
});
const pct = (key: string, label: string, only?: readonly PhotoToolId[]): OptionField => ({
  kind: 'slider',
  key,
  label,
  min: 0,
  max: 1,
  step: 0.01,
  percent: true,
  ...(only ? { only } : {}),
});
const hardness = pct('hardness', 'Hardness');
const opacity = pct('opacity', 'Opacity');
const flow = pct('flow', 'Flow');
const mode: OptionField = { kind: 'choice', key: 'mode', label: 'Mode', choices: BLENDS };
const tolerance: OptionField = {
  kind: 'slider',
  key: 'tolerance',
  label: 'Tolerance',
  min: 0,
  max: 255,
};
const sampleAll: OptionField = { kind: 'toggle', key: 'sampleAll', label: 'Sample All Layers' };
const pressure: OptionField = {
  kind: 'choice',
  key: 'pressure',
  label: 'Pressure',
  choices: [
    { value: 'size', label: 'Size' },
    { value: 'opacity', label: 'Opacity' },
    { value: 'both', label: 'Both' },
    { value: 'off', label: 'Off' },
  ],
};

export const OPTION_FIELDS: Record<keyof ToolOptions, readonly OptionField[]> = {
  brush: [
    size(),
    hardness,
    opacity,
    flow,
    pct('smoothing', 'Smoothing'),
    {
      kind: 'choice',
      key: 'mode',
      label: 'Mode',
      choices: [
        ...BLENDS,
        { value: 'behind', label: 'Behind' },
        { value: 'clear', label: 'Clear' },
      ],
    },
    pressure,
  ],
  pencil: [
    size(),
    opacity,
    mode,
    { kind: 'toggle', key: 'square', label: 'Square Tip' },
    { kind: 'toggle', key: 'autoErase', label: 'Auto Erase' },
  ],
  eraser: [
    {
      kind: 'choice',
      key: 'eraserMode',
      label: 'Mode',
      choices: [
        { value: 'brush', label: 'Brush' },
        { value: 'pencil', label: 'Pencil' },
        { value: 'block', label: 'Block' },
      ],
    },
    size(),
    hardness,
    opacity,
    flow,
    pressure,
  ],
  backgroundEraser: [
    size(),
    hardness,
    { kind: 'slider', key: 'tolerance', label: 'Tolerance', min: 0, max: 100, unit: '%' },
    { kind: 'toggle', key: 'continuous', label: 'Continuous Sampling' },
    { kind: 'toggle', key: 'contiguous', label: 'Contiguous' },
    { kind: 'toggle', key: 'protect', label: 'Protect Foreground Colour' },
  ],
  clone: [
    size(),
    hardness,
    opacity,
    flow,
    { kind: 'toggle', key: 'aligned', label: 'Aligned' },
    sampleAll,
  ],
  heal: [size(), hardness, { kind: 'toggle', key: 'aligned', label: 'Aligned' }, sampleAll],
  spotHeal: [size(500), { kind: 'toggle', key: 'proximity', label: 'Proximity Match' }],
  redEye: [pct('pupil', 'Pupil Size'), pct('darken', 'Darken')],
  focus: [
    size(),
    hardness,
    pct('strength', 'Strength'),
    { kind: 'toggle', key: 'protectDetail', label: 'Protect Detail', only: ['sharpen'] },
    { kind: 'toggle', key: 'fingerPainting', label: 'Finger Painting', only: ['smudge'] },
  ],
  tone: [
    size(),
    hardness,
    {
      kind: 'choice',
      key: 'range',
      label: 'Range',
      choices: [
        { value: 'shadows', label: 'Shadows' },
        { value: 'midtones', label: 'Midtones' },
        { value: 'highlights', label: 'Highlights' },
      ],
      only: ['dodge', 'burn'],
    },
    pct('exposure', 'Exposure', ['dodge', 'burn']),
    { kind: 'toggle', key: 'protectTones', label: 'Protect Tones', only: ['dodge', 'burn'] },
    { kind: 'toggle', key: 'saturate', label: 'Saturate', only: ['sponge'] },
    pct('flow', 'Flow', ['sponge']),
    { kind: 'toggle', key: 'vibrance', label: 'Vibrance', only: ['sponge'] },
  ],
  select: [
    { kind: 'slider', key: 'feather', label: 'Feather', min: 0, max: 250, unit: 'px' },
    { kind: 'toggle', key: 'antiAlias', label: 'Anti-alias' },
    {
      kind: 'choice',
      key: 'style',
      label: 'Style',
      choices: [
        { value: 'normal', label: 'Normal' },
        { value: 'ratio', label: 'Fixed Ratio' },
        { value: 'size', label: 'Fixed Size' },
      ],
      only: ['rect-select', 'ellipse-select'],
    },
  ],
  magnetic: [
    { kind: 'slider', key: 'width', label: 'Width', min: 1, max: 256, unit: 'px' },
    pct('contrast', 'Contrast'),
    { kind: 'slider', key: 'frequency', label: 'Frequency', min: 0, max: 100 },
  ],
  wand: [tolerance, { kind: 'toggle', key: 'contiguous', label: 'Contiguous' }, sampleAll],
  quick: [size(500), sampleAll, { kind: 'toggle', key: 'autoEnhance', label: 'Auto-Enhance' }],
  crop: [
    {
      kind: 'choice',
      key: 'ratio',
      label: 'Ratio',
      choices: [
        { value: 'free', label: 'Free' },
        { value: 'original', label: 'Original' },
        { value: '1:1', label: '1:1' },
        { value: '4:5', label: '4:5' },
        { value: '3:2', label: '3:2' },
        { value: '16:9', label: '16:9' },
        { value: '9:16', label: '9:16' },
      ],
    },
    { kind: 'toggle', key: 'deletePixels', label: 'Delete Cropped Pixels' },
  ],
  eyedropper: [
    {
      kind: 'choice',
      key: 'sample',
      label: 'Sample Size',
      choices: [
        { value: 1, label: 'Point' },
        { value: 3, label: '3 x 3 Average' },
        { value: 5, label: '5 x 5 Average' },
        { value: 11, label: '11 x 11 Average' },
        { value: 31, label: '31 x 31 Average' },
      ],
    },
    sampleAll,
  ],
  bucket: [
    tolerance,
    { kind: 'toggle', key: 'contiguous', label: 'Contiguous' },
    { kind: 'toggle', key: 'antiAlias', label: 'Anti-alias' },
    sampleAll,
    mode,
    opacity,
  ],
  gradient: [
    {
      kind: 'choice',
      key: 'style',
      label: 'Style',
      choices: [
        { value: 'linear', label: 'Linear' },
        { value: 'radial', label: 'Radial' },
        { value: 'angle', label: 'Angle' },
        { value: 'reflected', label: 'Reflected' },
        { value: 'diamond', label: 'Diamond' },
      ],
    },
    { kind: 'gradient', key: 'gradient', label: 'Gradient' },
    { kind: 'toggle', key: 'reverse', label: 'Reverse' },
    { kind: 'toggle', key: 'dither', label: 'Dither' },
    mode,
    opacity,
  ],
  text: [
    {
      kind: 'choice',
      key: 'font',
      label: 'Font',
      choices: FONTS.map((f) => ({ value: f.id, label: f.label })),
    },
    { kind: 'slider', key: 'size', label: 'Size', min: 4, max: 2000, unit: 'px' },
    {
      kind: 'choice',
      key: 'weight',
      label: 'Weight',
      choices: [
        { value: 400, label: 'Regular' },
        { value: 500, label: 'Medium' },
        { value: 700, label: 'Bold' },
      ],
    },
    { kind: 'toggle', key: 'italic', label: 'Italic' },
    {
      kind: 'choice',
      key: 'align',
      label: 'Align',
      choices: [
        { value: 'left', label: 'Left' },
        { value: 'centre', label: 'Centre' },
        { value: 'right', label: 'Right' },
      ],
    },
    { kind: 'slider', key: 'lineHeight', label: 'Line Height', min: 0.5, max: 3, step: 0.05 },
    { kind: 'slider', key: 'tracking', label: 'Tracking', min: -0.2, max: 1, step: 0.01 },
  ],
  shape: [
    { kind: 'toggle', key: 'fill', label: 'Fill' },
    { kind: 'toggle', key: 'stroke', label: 'Stroke', only: ['rectangle', 'ellipse'] },
    { kind: 'slider', key: 'strokeWidth', label: 'Width', min: 1, max: 200, unit: 'px' },
    {
      kind: 'slider',
      key: 'radius',
      label: 'Corner Radius',
      min: 0,
      max: 1000,
      unit: 'px',
      only: ['rectangle'],
    },
    { kind: 'toggle', key: 'startArrow', label: 'Start Arrow', only: ['line'] },
    { kind: 'toggle', key: 'endArrow', label: 'End Arrow', only: ['line'] },
    { kind: 'toggle', key: 'antiAlias', label: 'Anti-alias' },
    { kind: 'toggle', key: 'intoActive', label: 'Draw Into Active Layer' },
  ],
  move: [{ kind: 'toggle', key: 'autoSelect', label: 'Auto-Select' }],
};

/** The fields a tool shows. */
export function fieldsFor(tool: PhotoToolId, key: keyof ToolOptions): readonly OptionField[] {
  return OPTION_FIELDS[key].filter((f) => !f.only || f.only.includes(tool));
}

// The four ways a new selection meets the one there (photo-tools.md "Shared gestures and options").
export const SELECT_MODES: readonly { value: SelectMode; label: string }[] = [
  { value: 'new', label: 'New' },
  { value: 'add', label: 'Add' },
  { value: 'subtract', label: 'Subtract' },
  { value: 'intersect', label: 'Intersect' },
];

// The tools that make a selection, and so offer the four modes.
export const SELECTING: ReadonlySet<PhotoToolId> = new Set<PhotoToolId>([
  'rect-select',
  'ellipse-select',
  'lasso',
  'polygon-lasso',
  'magnetic-lasso',
  'magic-wand',
  'quick-select',
]);
