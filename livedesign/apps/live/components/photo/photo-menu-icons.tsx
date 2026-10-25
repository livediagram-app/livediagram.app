'use client';

// The photo menus' glyphs (docs/specs/031-photo/photo-pages.md "The title bar", photo-layers.md "The Layers tab"):
// every command's row carries its icon on the left, as the app's verb menus do (the canvas Layers menu, the Explorer
// actions menu); the adjustments and the filter categories each have their own.
import {
  lucideArrowLeftRight,
  lucideArrowUpDown,
  lucideBlend,
  lucideChartColumn,
  lucideCircleDashed,
  lucideContrast,
  lucideCrop,
  lucideDroplet,
  lucideDroplets,
  lucideEyeOff,
  lucideFlipHorizontal2,
  lucideFlipVertical2,
  lucideGrid3x3,
  lucideImagePlus,
  lucideLassoSelect,
  lucideLayers,
  lucideMaximize2,
  lucideMinimize2,
  lucidePalette,
  lucidePipette,
  lucideRefreshCw,
  lucideRotateCcw,
  lucideRotateCw,
  lucideRotateCwSquare,
  lucideScale,
  lucideScaling,
  lucideSlidersHorizontal,
  lucideSparkle,
  lucideSparkles,
  lucideSpline,
  lucideSquare,
  lucideSquareDashed,
  lucideSun,
  lucideThermometer,
  lucideWand,
  lucideWandSparkles,
  lucideWaves,
  lucideZap,
  lucideDices,
  lucideShapes,
  lucideFunnel,
} from '@liveworkspace/icons/lucide';
import { lucideGlyph } from '@livedesign/ui';
import type { AdjustmentId, FilterCategory } from '@livedesign/photo-engine';

type Glyph = ReturnType<typeof lucideGlyph>;
const g = (icon: Parameters<typeof lucideGlyph>[0]): Glyph => lucideGlyph(icon, 16);

// The title bar's commands, by their id (photo-actions).
const ACTION_GLYPHS: Readonly<Record<string, Glyph>> = {
  'auto-tone': g(lucideWand),
  'auto-contrast': g(lucideContrast),
  'auto-colour': g(lucidePalette),
  'image-size': g(lucideScaling),
  'canvas-size': g(lucideMaximize2),
  'rotate-cw': g(lucideRotateCw),
  'rotate-ccw': g(lucideRotateCcw),
  'rotate-180': g(lucideRefreshCw),
  rotate: g(lucideRotateCwSquare),
  'flip-h': g(lucideFlipHorizontal2),
  'flip-v': g(lucideFlipVertical2),
  'crop-to-selection': g(lucideCrop),
  trim: g(lucideMinimize2),
  'free-transform': g(lucideScaling),
  'place-picture': g(lucideImagePlus),
  'select-all': g(lucideSquareDashed),
  deselect: g(lucideEyeOff),
  reselect: g(lucideRefreshCw),
  inverse: g(lucideArrowLeftRight),
  subject: g(lucideWandSparkles),
  'colour-range': g(lucidePipette),
  'select-and-mask': g(lucideLassoSelect),
  grow: g(lucideMaximize2),
  expand: g(lucideArrowUpDown),
  contract: g(lucideMinimize2),
  border: g(lucideSquare),
  smooth: g(lucideSpline),
  feather: g(lucideSparkle),
  'remove-background': g(lucideWandSparkles),
  'repeat-filter': g(lucideRefreshCw),
};
const ActionDefault = g(lucideSlidersHorizontal);

export function ActionGlyph({ id }: { id: string }) {
  const G = ACTION_GLYPHS[id] ?? ActionDefault;
  return <G />;
}

const ADJUST_GLYPHS: Partial<Record<AdjustmentId, Glyph>> = {
  brightness: g(lucideSun),
  levels: g(lucideChartColumn),
  curves: g(lucideSpline),
  exposure: g(lucideSun),
  vibrance: g(lucideDroplets),
  'hue-saturation': g(lucidePalette),
  'colour-balance': g(lucideScale),
  'white-balance': g(lucideThermometer),
  'photo-filter': g(lucideDroplet),
  'selective-colour': g(lucidePipette),
  'channel-mixer': g(lucideSlidersHorizontal),
  'black-white': g(lucideContrast),
  'gradient-map': g(lucideBlend),
  invert: g(lucideFlipHorizontal2),
  posterize: g(lucideLayers),
  threshold: g(lucideContrast),
  'shadows-highlights': g(lucideSun),
  desaturate: g(lucideCircleDashed),
  equalize: g(lucideChartColumn),
};
const AdjustDefault = g(lucideSlidersHorizontal);

export function AdjustGlyph({ id }: { id: AdjustmentId }) {
  const G = ADJUST_GLYPHS[id] ?? AdjustDefault;
  return <G />;
}

const FILTER_GLYPHS: Readonly<Record<FilterCategory, Glyph>> = {
  blur: g(lucideDroplet),
  sharpen: g(lucideZap),
  noise: g(lucideDices),
  stylize: g(lucideSparkles),
  pixelate: g(lucideGrid3x3),
  distort: g(lucideWaves),
  render: g(lucideSun),
  enhance: g(lucideWand),
  other: g(lucideShapes),
};
const FilterDefault = g(lucideFunnel);

export function FilterGlyph({ category }: { category: FilterCategory }) {
  const G = FILTER_GLYPHS[category] ?? FilterDefault;
  return <G />;
}
