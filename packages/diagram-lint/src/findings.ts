// The shapes the shared lint code reads (docs/specs/024-agents/blueprints/diagram-lint.md "Interfaces and
// contracts", LN25), over a product's own codes `C`. Each product's `api-schema` keeps its wire types
// (`LintCode`, `LintFinding`, `LintReport`) as they are; they are these shapes with its codes filled in.

export type LintSeverity = 'error' | 'warning' | 'info';

export type LintFindingOf<C extends string> = {
  code: C;
  severity: LintSeverity;
  // Every ref involved, primary first.
  refs: string[];
  // Refs first, as printed.
  message: string;
  fix: string;
};

export type LintReportOf<C extends string> = {
  measures: {
    crossings: number | null;
    behind: number;
    overlaps: number;
    extent: { width: number; height: number } | null;
    arrows: number;
    boxes: number;
  };
  findings: LintFindingOf<C>[];
  counts: Record<LintSeverity, number>;
  skipped: { crossings: boolean };
};

// What a check returns before ordering: the finding without its severity, and where its primary subject
// sits for reading order (null reads first).
export type RawFindingOf<C extends string> = {
  code: C;
  refs: string[];
  message: string;
  fix: string;
  at: { x: number; y: number } | null;
};
