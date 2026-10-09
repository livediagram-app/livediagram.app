// The animation sets (docs/specs/028-animation/element-animations.md): one catalogue per family of
// elements, so each kind animates in ways that suit it. A body set animates the element itself
// (Shape, Sticky, Drawing, Media, Table); the Text set animates the words an element carries.
//
// A LEAF module, like './animation': it imports nothing from the barrel.

export type AnimationSetId = 'shape' | 'sticky' | 'drawing' | 'media' | 'table' | 'text';
export type BodyAnimationSet = Exclude<AnimationSetId, 'text'>;

// The Shape set: the fifteen motions every boxed element took before the sets split, rebuilt to
// the spec's quality bar. Their names and intent are unchanged, so saved values keep working.
export type ShapeAnimation =
  | 'pulse'
  | 'blink'
  | 'glow'
  | 'trace'
  | 'gradient'
  | 'heartbeat'
  | 'breathe'
  | 'shimmer'
  | 'highlight'
  | 'bounce'
  | 'wobble'
  | 'shake'
  | 'jelly'
  | 'float'
  | 'swing';
export const SHAPE_ANIMATIONS: readonly ShapeAnimation[] = [
  'pulse',
  'blink',
  'glow',
  'trace',
  'gradient',
  'heartbeat',
  'breathe',
  'shimmer',
  'highlight',
  'bounce',
  'wobble',
  'shake',
  'jelly',
  'float',
  'swing',
];

export type StickyAnimation =
  | 'flutter'
  | 'sway'
  | 'peel'
  | 'lift'
  | 'wiggle'
  | 'drop'
  | 'slap'
  | 'pulse'
  | 'glow'
  | 'highlight';
export const STICKY_ANIMATIONS: readonly StickyAnimation[] = [
  'flutter',
  'sway',
  'peel',
  'lift',
  'wiggle',
  'drop',
  'slap',
  'pulse',
  'glow',
  'highlight',
];

export type DrawingAnimation = 'draw' | 'trace' | 'dash' | 'boil' | 'ink' | 'glow' | 'shimmer';
export const DRAWING_ANIMATIONS: readonly DrawingAnimation[] = [
  'draw',
  'trace',
  'dash',
  'boil',
  'ink',
  'glow',
  'shimmer',
];

export type MediaAnimation =
  'kenburns' | 'zoom' | 'pan' | 'tilt' | 'develop' | 'focus' | 'wipe' | 'iris' | 'sheen';
export const MEDIA_ANIMATIONS: readonly MediaAnimation[] = [
  'kenburns',
  'zoom',
  'pan',
  'tilt',
  'develop',
  'focus',
  'wipe',
  'iris',
  'sheen',
];

export type TableAnimation =
  'rows' | 'columns' | 'cells' | 'scan' | 'sweep' | 'header' | 'pulse' | 'glow';
export const TABLE_ANIMATIONS: readonly TableAnimation[] = [
  'rows',
  'columns',
  'cells',
  'scan',
  'sweep',
  'header',
  'pulse',
  'glow',
];

export type TextAnimation =
  | 'typewriter'
  | 'words'
  | 'cascade'
  | 'focus'
  | 'scramble'
  | 'highlighter'
  | 'underline'
  | 'wave'
  | 'shine'
  | 'flicker'
  | 'rainbow'
  | 'glow'
  | 'bounce'
  | 'float';
export const TEXT_ANIMATIONS: readonly TextAnimation[] = [
  'typewriter',
  'words',
  'cascade',
  'focus',
  'scramble',
  'highlighter',
  'underline',
  'wave',
  'shine',
  'flicker',
  'rainbow',
  'glow',
  'bounce',
  'float',
];

// The stored `animation` field of every boxed element: any body set's value. Every value saved
// before the split is a Shape value, so it stays valid.
export type ElementAnimation =
  ShapeAnimation | StickyAnimation | DrawingAnimation | MediaAnimation | TableAnimation;

export const ANIMATION_SET_VALUES: Readonly<Record<AnimationSetId, readonly string[]>> = {
  shape: SHAPE_ANIMATIONS,
  sticky: STICKY_ANIMATIONS,
  drawing: DRAWING_ANIMATIONS,
  media: MEDIA_ANIMATIONS,
  table: TABLE_ANIMATIONS,
  text: TEXT_ANIMATIONS,
};

// Reveals bring the element or its words in; everything else is a loop around the rest frame.
const REVEALS: Readonly<Record<AnimationSetId, ReadonlySet<string>>> = {
  shape: new Set(),
  sticky: new Set(['drop', 'slap']),
  drawing: new Set(['draw']),
  media: new Set(['develop', 'focus', 'wipe', 'iris']),
  table: new Set(['rows', 'columns', 'cells']),
  text: new Set([
    'typewriter',
    'words',
    'cascade',
    'focus',
    'scramble',
    'highlighter',
    'underline',
  ]),
};

export function isRevealAnimation(set: AnimationSetId, value: string | null | undefined): boolean {
  return value != null && REVEALS[set].has(value);
}

export function isAnimationInSet(set: AnimationSetId, value: string | null | undefined): boolean {
  return value != null && ANIMATION_SET_VALUES[set].includes(value);
}

export function isTextAnimation(value: unknown): value is TextAnimation {
  return typeof value === 'string' && (TEXT_ANIMATIONS as readonly string[]).includes(value);
}

// A value saved before the sets split that this set does not offer: it keeps playing, and the
// menu shows it as one extra tile so it can be seen and replaced. Only Shape values existed then.
export function keptAnimation(
  set: AnimationSetId,
  value: string | null | undefined,
): ShapeAnimation | undefined {
  if (value == null || isAnimationInSet(set, value)) return undefined;
  return (SHAPE_ANIMATIONS as readonly string[]).includes(value)
    ? (value as ShapeAnimation)
    : undefined;
}

// A set's section name inside the menu's Animation row (docs/specs/028-animation/element-animations.md
// "The menu"): Animation is the parent, so each section is named by its set alone.
export const ANIMATION_SET_NAME: Readonly<Record<AnimationSetId, string>> = {
  shape: 'Shape',
  sticky: 'Sticky',
  drawing: 'Drawing',
  media: 'Media',
  table: 'Table',
  text: 'Text',
};

// Tile labels where the stored value is not simply the label lower-cased.
const LABELS: Readonly<Record<string, string>> = { kenburns: 'Ken Burns' };

export function animationLabel(value: string): string {
  return LABELS[value] ?? value.charAt(0).toUpperCase() + value.slice(1);
}

// What a pick reports to telemetry (docs/specs/017-telemetry/telemetry.md), per set.
export const ANIMATION_SET_TELEMETRY_TYPE: Readonly<Record<AnimationSetId, string>> = {
  shape: 'Animation',
  sticky: 'StickyAnimation',
  drawing: 'DrawingAnimation',
  media: 'MediaAnimation',
  table: 'TableAnimation',
  text: 'TextAnimation',
};
