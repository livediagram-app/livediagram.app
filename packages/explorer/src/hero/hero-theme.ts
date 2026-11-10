// Each app's hero theme, drawn once and read twice (liveworkspace/docs/specs/004-index/one-explorer.md "Each app's
// backdrop, on Home's hero"): Home's hero backdrop (HeroBackdrop) and every editor's start panel header
// (@liveworkspace/workbench's StartHeaderBand). Plain data, no React, so an editor that reads it pulls in nothing else
// of the Explorer.

import type { App } from '@liveworkspace/index-client';

export type HeroBackdropKind = 'dots' | 'lanes' | 'blueprint' | 'typesetter' | 'shapes' | 'huddle';

/** Which backdrop is each app's own. */
export const APP_BACKDROP: Record<App, HeroBackdropKind> = {
  liveplanner: 'lanes',
  livediagram: 'blueprint',
  livedocuments: 'typesetter',
  livedesign: 'shapes',
  livehuddle: 'huddle',
};

/** The heading's face on Home's hero: the Typesetter sets it in the system's serif, the others in the page's own. */
export function heroHeadingFace(backdrop: HeroBackdropKind): string {
  return backdrop === 'typesetter'
    ? 'font-serif font-semibold tracking-[-0.02em]'
    : 'font-extrabold tracking-[-0.04em]';
}

/** The same face at a start header's 20px: the hero's tracking, eased for the smaller size. */
export function startHeadingFace(backdrop: HeroBackdropKind): string {
  return backdrop === 'typesetter'
    ? 'font-serif font-semibold tracking-[-0.01em]'
    : 'font-extrabold tracking-[-0.025em]';
}

// The textures' measures, the same on the hero and the start header so the two read as one drawing.
/** Blueprint: a fine square, and a heavier line every five of them. */
export const BLUEPRINT_MINOR_PX = 24;
export const BLUEPRINT_MAJOR_PX = BLUEPRINT_MINOR_PX * 5;
/** Typesetter: the baseline grid's pitch. */
export const BASELINE_PX = 8;
/** Dots: one dot every this many pixels. */
export const DOTS_PX = 22;
/** Huddle: the gap between the voice rings that spread from where the room speaks. */
export const HUDDLE_RING_PX = 28;
/** Board lanes, named at the hero's foot. */
export const LANE_NAMES = ['To do · 4', 'Doing · 2/3', 'Review · 1', 'Done · 12'] as const;
