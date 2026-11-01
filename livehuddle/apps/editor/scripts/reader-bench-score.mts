// Scoring reader-bench.mts runs: one row per results file.
//
//   pnpm --filter @livediagram/live exec tsx scripts/reader-bench-score.mts /tmp/reader-sweep/*.json
//
// For a note with words: EXACT (case- and punctuation-insensitive), WORDS (share
// of true words present), CER, and INVENTED — an answer that is mostly not the
// note (CER above 0.6), which is what a reader too far from its depth hands
// back. For a note too small to read, every answer that is not a blank is
// invented. Each is counted twice: as the model answered, and after the editor's
// own filter of that answer (toRead in browser-reader.ts), so a guard can be
// judged by what it removes AND what it wrongly takes away.
//
// Prints numbers only; the words themselves stay in the results files, which
// are private.
import { readFileSync } from 'node:fs';
import { levenshtein, norm } from '../../../scripts/read-bench.mts';
import { readAnswer, toRead } from '../lib/reading/answer';

const INVENTED_CER = 0.6;

type Result = { truth: string | null; read: string; ms: number; width: number; height: number };
type Run = { reader: string; set: string; edge?: number; loadMs: number; results: Result[] };

const cer = (got: string, want: string) =>
  want === '' ? (got === '' ? 0 : 1) : levenshtein(got, want) / want.length;

export function scoreRun(results: Result[], filtered: boolean) {
  let exact = 0;
  let words = 0;
  let wordsHit = 0;
  let errors = 0;
  let chars = 0;
  let invented = 0;
  let blank = 0;
  let lostExact = 0;
  for (const r of results) {
    const unfiltered = norm(readAnswer(r.read).text);
    const answer = filtered ? norm(toRead(r.read).text) : unfiltered;
    // A reading the filter took away that was RIGHT: the one thing it must never do.
    if (r.truth && unfiltered === norm(r.truth) && answer !== unfiltered) lostExact += 1;
    if (answer === '') blank += 1;
    if (!r.truth) {
      if (answer !== '') invented += 1;
      continue;
    }
    const want = norm(r.truth);
    chars += want.length;
    errors += levenshtein(answer, want);
    if (answer === want) exact += 1;
    const got = new Set(answer.split(' '));
    for (const w of want.split(' ')) {
      words += 1;
      if (got.has(w)) wordsHit += 1;
    }
    if (answer !== '' && cer(answer, want) > INVENTED_CER) invented += 1;
  }
  return {
    n: results.length,
    exact,
    words: words === 0 ? null : wordsHit / words,
    cer: chars === 0 ? null : errors / chars,
    invented,
    blank,
    lostExact,
  };
}

const pct = (v: number | null) => (v === null ? '-' : `${(100 * v).toFixed(0)}%`);

console.log(
  '| reader | set | short edge | notes | exact | words | CER | invented | blank | exact lost to filter | median s/crop |',
);
console.log('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |');
for (const file of process.argv.slice(2)) {
  const run = JSON.parse(readFileSync(file, 'utf8')) as Run;
  const ms = run.results.map((r) => r.ms).sort((a, b) => a - b);
  const median = ms[Math.floor(ms.length / 2)] ?? 0;
  for (const filtered of [false, true]) {
    const s = scoreRun(run.results, filtered);
    console.log(
      `| ${run.reader}${filtered ? ' + filter' : ''} | ${run.set} | ${run.edge ?? 'full'} | ${s.n} | ${s.exact} | ${pct(s.words)} | ${pct(s.cer)} | ${s.invented} | ${s.blank} | ${filtered ? s.lostExact : '-'} | ${(median / 1000).toFixed(2)} |`,
    );
  }
}
