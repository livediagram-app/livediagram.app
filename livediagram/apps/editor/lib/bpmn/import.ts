// A .bpmn file into the active tab's elements, and the report the Import dialog shows
// (docs/specs/020-import-export/bpmn-import.md). Lazy-loaded by useTabImport.

import type { Element } from '@livediagram/document';
import type { ReportRule } from '@/lib/board-scene/report';
import type { ImportOutcome } from '@/lib/import-tab';
import { textImportOutcome } from '@/lib/text-import-report';
import { convertBpmn, type BpmnTally } from './convert';
import { BPMN_REPORT_NAMES_MAX } from './limits';
import { BpmnRefused, readBpmn } from './read';

export const BPMN_REPORT_SUBTITLE = "Here's how your BPMN came across.";

export type BpmnImport =
  { ok: true; elements: Element[]; tally: BpmnTally } | { ok: false; error: string };

/** The file's first diagram as elements; a refusal's message when it can't be read. */
export function importBpmn(text: string): BpmnImport {
  try {
    const { elements, tally } = convertBpmn(readBpmn(text));
    return { ok: true, elements, tally };
  } catch (error) {
    if (error instanceof BpmnRefused) return { ok: false, error: error.message };
    throw error;
  }
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/** The import's report: what changed on the way; nothing to say closes the dialog. */
export function bpmnImportOutcome(elements: readonly Element[], tally: BpmnTally): ImportOutcome {
  const degraded: ReportRule[] = [];
  const skipped: ReportRule[] = [];
  if (tally.approximated > 0)
    degraded.push({
      rule: 'Drawn as the nearest BPMN symbol: a marker or a sub-process type livediagram does not draw yet',
      count: tally.approximated,
    });
  if (tally.vertical > 0)
    degraded.push({
      rule: 'Vertical pools and lanes keep their title across the top',
      count: tally.vertical,
    });
  const unmatched = [...tally.unmatched.entries()];
  const unmatchedCount = unmatched.reduce((sum, [, n]) => sum + n, 0);
  if (unmatchedCount > 0) {
    const names = unmatched.slice(0, BPMN_REPORT_NAMES_MAX).map(([type]) => type);
    const more = unmatched.length > names.length ? ', ...' : '';
    degraded.push({
      rule: `Labelled boxes for shapes with no BPMN symbol here (${names.join(', ')}${more})`,
      count: unmatchedCount,
    });
  }
  if (tally.leftOut > 0)
    skipped.push({ rule: 'Left out past the 2,000 element limit', count: tally.leftOut });
  if (tally.unrouted > 0)
    skipped.push({
      rule: plural(
        tally.unrouted,
        'A flow with no route in the file',
        'Flows with no route in the file',
      ),
      count: tally.unrouted,
    });
  if (tally.otherDiagrams > 0)
    skipped.push({
      rule: 'Further diagrams in the file: only the first is drawn',
      count: tally.otherDiagrams,
    });
  return textImportOutcome(elements, { subtitle: BPMN_REPORT_SUBTITLE, degraded, skipped });
}
