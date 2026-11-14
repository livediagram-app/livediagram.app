// A build: when an element comes onto a presented slide, and how (docs/specs/012-collaboration/presentation-mode.md
// "Builds"). Its own module with no imports, so the element types can name it without a cycle; the helpers that read
// and step builds are in slide-builds.ts.

/** How a build comes in: cut in, fade in, or fade in while rising into place. */
export const BUILD_EFFECTS = ['appear', 'fade', 'rise'] as const;
export type BuildEffect = (typeof BUILD_EFFECTS)[number];

/** The step an element comes in at (a whole number from 1; equal orders come in together) and how. */
export type ElementBuild = { order: number; effect: BuildEffect };
