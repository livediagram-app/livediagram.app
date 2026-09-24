import { meetsBar, type Score } from '../../sticky-vision/scripts/truth';

// The per-wall table in the same columns as the classical sweep
// (`sticky-vision/scripts/calibrate.ts`), so the two read side by side.

export type Row = { name: string; score: Score; ms: number };

const pc = (v: number) => `${(v * 100).toFixed(0)}%`;

export function totals(rows: readonly Row[]) {
  const truth = rows.reduce((a, r) => a + r.score.truth, 0);
  const detected = rows.reduce((a, r) => a + r.score.detected, 0);
  const matched = rows.reduce((a, r) => a + r.score.matched, 0);
  const precision = detected ? matched / detected : 0;
  const recall = truth ? matched / truth : 0;
  const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
  const merged = rows.reduce((a, r) => a + r.score.merged, 0);
  const passing = rows.filter((r) => meetsBar(r.score)).length;
  return { truth, detected, matched, precision, recall, f1, merged, passing };
}

export function table(rows: readonly Row[]): string {
  const lines = [
    `  ${'photo'.padEnd(20)}${'found'.padStart(7)}${'truth'.padStart(7)}${'prec'.padStart(7)}${'recall'.padStart(8)}` +
      `${'F1'.padStart(6)}${'rec-A'.padStart(7)}${'actors'.padStart(8)}${'merged'.padStart(8)}${'ms'.padStart(7)}  bar`,
  ];
  for (const { name, score: s, ms } of rows) {
    lines.push(
      `  ${name.padEnd(20)}${String(s.detected).padStart(7)}${String(s.truth).padStart(7)}${pc(s.precision).padStart(7)}` +
        `${pc(s.recall).padStart(8)}${pc(s.f1).padStart(6)}${pc(s.recallWithoutActors).padStart(7)}` +
        `${`${s.actors.matched}/${s.actors.truth}`.padStart(8)}${String(s.merged).padStart(8)}${ms.toFixed(0).padStart(7)}` +
        `  ${meetsBar(s) ? 'PASS' : 'FAIL'}`,
    );
  }
  const t = totals(rows);
  lines.push(
    `  ${'TOTAL'.padEnd(20)}${String(t.detected).padStart(7)}${String(t.truth).padStart(7)}${pc(t.precision).padStart(7)}` +
      `${pc(t.recall).padStart(8)}${`${(t.f1 * 100).toFixed(1)}%`.padStart(7)}${''.padStart(14)}${String(t.merged).padStart(8)}` +
      `${''.padStart(7)}  ${t.passing}/${rows.length} walls`,
  );
  return lines.join('\n');
}
