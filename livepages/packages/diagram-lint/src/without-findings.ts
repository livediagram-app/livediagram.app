// A lint report with one code's findings taken out, its counts made to match (a template's own colours, which are its
// design, are not put to the agent: docs/specs/024-agents/diagram-lint.md "Where it runs").
import type { LintCode, LintReport } from '@livepages/api-schema';

export function withoutFindings(report: LintReport, code: LintCode): LintReport {
  const findings = report.findings.filter((f) => f.code !== code);
  const counts = { error: 0, warning: 0, info: 0 };
  for (const f of findings) counts[f.severity]++;
  return { ...report, findings, counts };
}
