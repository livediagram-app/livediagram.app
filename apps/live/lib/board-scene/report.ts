// The landing's report (docs/specs/020-import-export/board-scene.md "The report"): counts per
// landed kind, and every degraded and skipped rule with its count, the parser's and the landing's
// together. Nothing is lost silently.
import type { SceneItemKind, SceneNote } from './scene';

export type ReportRule = { rule: string; count: number };
export type BoardSceneReport = {
  landed: Partial<Record<SceneItemKind, number>>;
  degraded: ReportRule[];
  skipped: ReportRule[];
};

// What each landed kind is counted as, singular and plural.
export const LANDED_KIND_COPY: Readonly<Record<SceneItemKind, readonly [string, string]>> = {
  ink: ['pen stroke', 'pen strokes'],
  polyline: ['line', 'lines'],
  shape: ['shape', 'shapes'],
  connector: ['arrow', 'arrows'],
  text: ['text box', 'text boxes'],
  sticky: ['sticky note', 'sticky notes'],
  image: ['image', 'images'],
  frame: ['frame', 'frames'],
};

/** "3 pen strokes", "1 frame". */
export function landedKindLabel(kind: SceneItemKind, count: number): string {
  const [one, many] = LANDED_KIND_COPY[kind];
  return `${count} ${count === 1 ? one : many}`;
}

/** Notes merged by rule and kind, counts added, in first-seen order. */
export function mergeNotes(
  notes: readonly SceneNote[],
): Pick<BoardSceneReport, 'degraded' | 'skipped'> {
  const degraded = new Map<string, ReportRule>();
  const skipped = new Map<string, ReportRule>();
  for (const note of notes) {
    if (!(note.count > 0)) continue;
    const into = note.kind === 'skipped' ? skipped : degraded;
    const found = into.get(note.rule);
    if (found) found.count += note.count;
    else into.set(note.rule, { rule: note.rule, count: note.count });
  }
  return { degraded: [...degraded.values()], skipped: [...skipped.values()] };
}

/** Whether a report has anything to say beyond what landed. */
export function reportHasLosses(report: BoardSceneReport): boolean {
  return report.degraded.length > 0 || report.skipped.length > 0;
}
