// The page lint's wire types (docs/specs/024-agents/page-lint.md; blueprint "Interfaces and contracts", LN25): what
// the `?view=lint` JSON, a changeset's `lint` and the CLI carry.

// The spec's codes, in its table order.
export const LINT_CODES = ['label-overflow', 'text-overflow'] as const;
export type LintCode = (typeof LINT_CODES)[number];

export const LINT_SEVERITIES = ['error', 'warning', 'info'] as const;
export type LintSeverity = (typeof LINT_SEVERITIES)[number];

// Fixed per code by the spec.
export const LINT_SEVERITY: Readonly<Record<LintCode, LintSeverity>> = {
  'label-overflow': 'warning',
  'text-overflow': 'warning',
};

export type LintFinding = {
  code: LintCode;
  severity: LintSeverity;
  // Every ref involved, primary first.
  refs: string[];
  // Refs first, as printed.
  message: string;
  fix: string;
};

export type LintMeasures = {
  // The drawing's rounded extent; null when nothing is visible.
  extent: { width: number; height: number } | null;
  // Labelled boxes and text elements checked.
  boxes: number;
  texts: number;
};

export type LintReport = {
  measures: LintMeasures;
  findings: LintFinding[];
  counts: Record<LintSeverity, number>;
};
