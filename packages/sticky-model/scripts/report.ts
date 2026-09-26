import { meetsBar, type Score } from '../../sticky-vision/scripts/truth';

// The per-wall table in the same columns as the classical sweep
// (`sticky-vision/scripts/calibrate.ts`), so the two read side by side, plus
// two columns that explain the merged count:
//
// - `real`: merged boxes that match NO label, i.e. boxes that are not a correct
//   detection of any one note. The official `merged` also counts a CORRECT box
//   for a note stuck more than half over another, because the lower note's
//   centre then lies inside it.
// - `floor`: that count for the labels themselves, i.e. the merged score of a
//   perfect detector.

export type Row = { name: string; score: Score; ms: number; realMerged: number; floor: number };

type Box = { x: number; y: number; w: number; h: number };

const holds = (b: Box, labels: readonly Box[]) =>
  labels.filter((l) => {
    const cx = l.x + l.w / 2;
    const cy = l.y + l.h / 2;
    return cx >= b.x && cx <= b.x + b.w && cy >= b.y && cy <= b.y + b.h;
  }).length;

export function realMergedOf(score: Score, labels: readonly Box[]): number {
  return score.spurious.filter((b) => holds(b, labels) >= 2).length;
}

export function mergedFloorOf(labels: readonly Box[]): number {
  return labels.filter((b) => holds(b, labels) >= 2).length;
}

const pc = (v: number) => `${(v * 100).toFixed(0)}%`;

export function totals(rows: readonly Row[]) {
  const sum = (f: (r: Row) => number) => rows.reduce((a, r) => a + f(r), 0);
  const truth = sum((r) => r.score.truth);
  const detected = sum((r) => r.score.detected);
  const matched = sum((r) => r.score.matched);
  const precision = detected ? matched / detected : 0;
  const recall = truth ? matched / truth : 0;
  const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
  return {
    truth,
    detected,
    matched,
    precision,
    recall,
    f1,
    merged: sum((r) => r.score.merged),
    realMerged: sum((r) => r.realMerged),
    floor: sum((r) => r.floor),
    passing: rows.filter((r) => meetsBar(r.score)).length,
  };
}

export function table(rows: readonly Row[]): string {
  const lines = [
    `  ${'photo'.padEnd(20)}${'found'.padStart(7)}${'truth'.padStart(7)}${'prec'.padStart(7)}${'recall'.padStart(8)}` +
      `${'F1'.padStart(6)}${'rec-A'.padStart(7)}${'actors'.padStart(8)}${'merged'.padStart(8)}${'real'.padStart(6)}` +
      `${'floor'.padStart(7)}${'ms'.padStart(7)}  bar`,
  ];
  for (const { name, score: s, ms, realMerged, floor } of rows) {
    lines.push(
      `  ${name.padEnd(20)}${String(s.detected).padStart(7)}${String(s.truth).padStart(7)}${pc(s.precision).padStart(7)}` +
        `${pc(s.recall).padStart(8)}${pc(s.f1).padStart(6)}${pc(s.recallWithoutActors).padStart(7)}` +
        `${`${s.actors.matched}/${s.actors.truth}`.padStart(8)}${String(s.merged).padStart(8)}` +
        `${String(realMerged).padStart(6)}${String(floor).padStart(7)}${ms.toFixed(0).padStart(7)}` +
        `  ${meetsBar(s) ? 'PASS' : 'FAIL'}`,
    );
  }
  const t = totals(rows);
  lines.push(
    `  ${'TOTAL'.padEnd(20)}${String(t.detected).padStart(7)}${String(t.truth).padStart(7)}${pc(t.precision).padStart(7)}` +
      `${pc(t.recall).padStart(8)}${`${(t.f1 * 100).toFixed(1)}%`.padStart(7)}${''.padStart(14)}${String(t.merged).padStart(8)}` +
      `${String(t.realMerged).padStart(6)}${String(t.floor).padStart(7)}${''.padStart(7)}  ${t.passing}/${rows.length} walls`,
  );
  return lines.join('\n');
}
