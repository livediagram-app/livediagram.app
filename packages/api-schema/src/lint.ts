// The diagram lint's wire types (docs/specs/024-agents/diagram-lint.md; blueprint "Interfaces and
// contracts", LN25): what the `?view=lint` JSON, a changeset's `lint` and the CLI carry.

// The spec's codes, in its table order.
export const LINT_CODES = [
  'box-overlap',
  'arrow-dangling',
  'arrow-behind-box',
  'edge-crossings',
  'label-collision',
  'label-overflow',
  'node-isolated',
  'group-escape',
  'group-split-edges',
  'duplicate-label',
  'flow-backwards',
  'aspect-extreme',
  'colour-on-themed',
] as const;
export type LintCode = (typeof LINT_CODES)[number];

export const LINT_SEVERITIES = ['error', 'warning', 'info'] as const;
export type LintSeverity = (typeof LINT_SEVERITIES)[number];

// Fixed per code by the spec.
export const LINT_SEVERITY: Readonly<Record<LintCode, LintSeverity>> = {
  'box-overlap': 'error',
  'arrow-dangling': 'error',
  'arrow-behind-box': 'warning',
  'edge-crossings': 'warning',
  'label-collision': 'warning',
  'label-overflow': 'warning',
  'node-isolated': 'warning',
  'group-escape': 'warning',
  'group-split-edges': 'info',
  'duplicate-label': 'info',
  'flow-backwards': 'info',
  'aspect-extreme': 'info',
  'colour-on-themed': 'info',
};

export type LintFinding = {
  code: LintCode;
  severity: LintSeverity;
  // Every ref involved, primary first; empty only for `aspect-extreme`.
  refs: string[];
  // Refs first, as printed.
  message: string;
  fix: string;
};

export type LintMeasures = {
  // Crossing arrow pairs; null when the pair check was skipped.
  crossings: number | null;
  // `arrow-behind-box` findings.
  behind: number;
  // `box-overlap` findings.
  overlaps: number;
  // The drawing's rounded extent; null when nothing is visible.
  extent: { width: number; height: number } | null;
  // Drawable arrows and boxes checked.
  arrows: number;
  boxes: number;
};

export type LintReport = {
  measures: LintMeasures;
  findings: LintFinding[];
  counts: Record<LintSeverity, number>;
  skipped: { crossings: boolean };
};

export function isLintCode(value: unknown): value is LintCode {
  return LINT_CODES.some((code) => code === value);
}
