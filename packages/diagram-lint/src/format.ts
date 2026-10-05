// The lint as text (blueprint "Presentation and UX", LN19 to LN22): one summary line, then one finding a
// line, refs first and the fix last; the verdict a changeset's footer carries.

import type { LintCode, LintFinding, LintReport, LintSeverity } from '@livediagram/api-schema';
import { LINT_MAX_LINES_PER_CODE, LINT_MESSAGE_COLUMN_MAX } from './constants';

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

const LETTER: Readonly<Record<LintSeverity, string>> = { error: 'E', warning: 'W', info: 'I' };
// The longest code.
const CODE_COLUMN = 17;

// `clean`, or the non-zero severity counts.
export function lintVerdict(report: LintReport): string {
  const { error, warning, info } = report.counts;
  const parts = [
    error ? plural(error, 'error', 'errors') : '',
    warning ? plural(warning, 'warning', 'warnings') : '',
    info ? `${info} info` : '',
  ].filter(Boolean);
  return parts.length ? parts.join(', ') : 'clean';
}

export function lintSummaryLine(report: LintReport): string {
  const { crossings, behind, overlaps, extent, arrows } = report.measures;
  const crossed =
    crossings === null
      ? `crossings skipped (${arrows} arrows)`
      : plural(crossings, 'crossing', 'crossings');
  const size = extent ? `${extent.width}×${extent.height}` : 'empty';
  return `${crossed} · ${behind} behind · ${plural(overlaps, 'overlap', 'overlaps')} · ${size} → ${lintVerdict(report)}`;
}

// What a changeset result's footer carries: `lint clean`, `lint 2 warnings, 1 info`, or `lint unavailable`.
export function lintFooterPart(report: LintReport | null): string {
  return report ? `lint ${lintVerdict(report)}` : 'lint unavailable';
}

// The findings each code prints, at most LINT_MAX_LINES_PER_CODE, and how many more there are (LN20).
function printed(findings: readonly LintFinding[]): {
  shown: LintFinding[];
  more: Map<LintCode, number>;
} {
  const seen = new Map<LintCode, number>();
  const shown: LintFinding[] = [];
  const more = new Map<LintCode, number>();
  for (const finding of findings) {
    const n = (seen.get(finding.code) ?? 0) + 1;
    seen.set(finding.code, n);
    if (n <= LINT_MAX_LINES_PER_CODE) shown.push(finding);
    else more.set(finding.code, n - LINT_MAX_LINES_PER_CODE);
  }
  return { shown, more };
}

export function formatLintReport(report: LintReport): string {
  const { shown, more } = printed(report.findings);
  const column = Math.min(
    LINT_MESSAGE_COLUMN_MAX,
    Math.max(0, ...shown.map((f) => [...f.message].length)),
  );
  const pad = (text: string) => text + ' '.repeat(Math.max(0, column - [...text].length));
  const lines = [lintSummaryLine(report)];
  for (const [i, f] of shown.entries()) {
    lines.push(
      `${LETTER[f.severity]} ${f.code.padEnd(CODE_COLUMN)}  ${pad(f.message)}  fix: ${f.fix}`,
    );
    const next = shown[i + 1];
    const extra = more.get(f.code);
    if (extra && next?.code !== f.code) lines.push(`… ${extra} more ${f.code}`);
  }
  return lines.join('\n');
}
