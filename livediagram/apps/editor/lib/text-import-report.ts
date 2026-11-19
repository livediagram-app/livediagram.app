// The report a text import shows instead of closing when it skipped or changed something (the infrastructure import,
// docs/specs/020-import-export/infrastructure-import.md "The editor"; Mermaid, docs/specs/020-import-export/mermaid.md
// "Unreadable lines are said, not lost"): what landed, counted from the drawn elements, then the rules. Nothing to say
// closes the dialog.

import type { Element } from '@livediagram/document';
import type { ReportRule } from '@/lib/board-scene/report';
import type { ImportOutcome } from '@/lib/import-tab';

export function textImportOutcome(
  elements: readonly Element[],
  report: { subtitle: string; degraded?: ReportRule[]; skipped: ReportRule[] },
): ImportOutcome {
  const degraded = report.degraded ?? [];
  const { skipped } = report;
  if (degraded.length === 0 && skipped.length === 0) return { status: 'done' };
  return {
    status: 'done',
    subtitle: report.subtitle,
    scene: { landed: landedOf(elements), degraded, skipped },
  };
}

// What a drawing holds, as a report's "landed" line counts it: boxes, lines and frames.
export function landedOf(elements: readonly Element[]) {
  let shape = 0;
  let connector = 0;
  let frame = 0;
  for (const el of elements) {
    if (el.type === 'arrow') connector += 1;
    else if (el.type === 'shape' && el.shape === 'frame') frame += 1;
    else if (el.type === 'shape') shape += 1;
  }
  return { shape, connector, ...(frame ? { frame } : {}) };
}

export const MERMAID_REPORT_SUBTITLE = "Here's how your Mermaid came across.";

// A Mermaid import's report: the nested subgraphs that folded into their outer frame, and the lines it could not read
// (quoted by the parser's own `unreadMermaidLines`, the line the MCP's notes carry).
export function mermaidImportOutcome(
  elements: readonly Element[],
  read: { folded?: number; unread?: readonly string[] },
  unreadLine: (unread: readonly string[]) => string,
): ImportOutcome {
  const folded = read.folded ?? 0;
  const unread = read.unread ?? [];
  return textImportOutcome(elements, {
    subtitle: MERMAID_REPORT_SUBTITLE,
    degraded:
      folded > 0
        ? [
            {
              rule: 'Nested subgraphs folded into their outer group: groups draw one level deep',
              count: folded,
            },
          ]
        : [],
    skipped: unread.length > 0 ? [{ rule: unreadLine(unread), count: unread.length }] : [],
  });
}
