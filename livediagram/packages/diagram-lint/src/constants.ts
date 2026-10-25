// Every number the lint judges by (docs/specs/024-agents/blueprints/diagram-lint.md "Constants and
// configuration"): the shared ones, then those only this product's own checks use.

export * from '@liveworkspace/diagram-lint/constants';

export const LINT_MAX_ASPECT = 3;
// A member reaching its frame's border (LN13).
export const LINT_CONTAIN_TOLERANCE_PX = 2;
// "Most" of a frame's arrows: more than half of at least three (LN12).
export const LINT_GROUP_SPLIT_SHARE = 0.5;
export const LINT_GROUP_SPLIT_MIN_ARROWS = 3;
// One or two boxes have a shape, not a layout (LN16).
export const LINT_ASPECT_MIN_BOXES = 3;
