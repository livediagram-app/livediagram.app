/**
 * Bounds for a typed-in size (docs/specs/008-canvas/element-size.md). A zero or negative box is not a
 * shape, and a runaway one (a stray extra digit) is a canvas nobody can pan
 * out of, so the box is clamped rather than trusted.
 */
export const MIN_SIZE_PX = 8;
export const MAX_SIZE_PX = 20000;
