import { collectRows, labelledNotes, type BoxRow } from './junk-features';

// Learning a junk gate leave-one-wall-out (plans/event-storming-photo-95-
// experiments C3): for each labelled wall, rules are fitted on the OTHER
// seven and scored on it, so no wall's number is flattered by having been
// fitted to it.
//
// A rule is a conjunction of one or two thresholds ("edge1 < 0.02 AND valIn
// < 0.45"); rules are found greedily by sequential covering — take the rule
// that removes the most junk for the fewest notes, drop what it covered,
// repeat. A rule must cover junk on at least MIN_WALLS training walls, so it
// describes a KIND of junk rather than one photograph's.
//
//   npx tsx scripts/junk-rules.ts [--cost 4] [--walls 2] [--rules 4] [--pairs]

const arg = (name: string, fallback: number) => {
  const i = process.argv.indexOf(name);
  return i === -1 ? fallback : Number(process.argv[i + 1]);
};
const NOTE_COST = arg('--cost', 4);
const MIN_WALLS = arg('--walls', 2);
const MAX_RULES = arg('--rules', 4);
const MIN_SUPPORT = arg('--support', 4);
const MAX_TRAIN_NOTES = arg('--maxnotes', 1);
const GRID = arg('--grid', 40);
const PAIRS = process.argv.includes('--pairs');
const ONLY = process.argv.includes('--only')
  ? process.argv[process.argv.indexOf('--only') + 1]!.split(',')
  : null;

type Cond = { f: string; lt: boolean; t: number };
type Rule = Cond[];

const holds = (r: BoxRow, c: Cond) => (c.lt ? r.f[c.f]! < c.t : r.f[c.f]! > c.t);
const fires = (r: BoxRow, rule: Rule) => rule.every((c) => holds(r, c));
const show = (rule: Rule) =>
  rule.map((c) => `${c.f} ${c.lt ? '<' : '>'} ${c.t.toFixed(3)}`).join(' AND ');

function candidates(rows: BoxRow[], features: string[]): Cond[] {
  const out: Cond[] = [];
  for (const f of features) {
    const values = rows.map((r) => r.f[f]!).sort((a, b) => a - b);
    const seen = new Set<number>();
    for (let k = 1; k < GRID; k += 1) {
      const t = values[Math.floor((values.length * k) / GRID)]!;
      if (seen.has(t)) continue;
      seen.add(t);
      out.push({ f, lt: true, t }, { f, lt: false, t });
    }
  }
  return out;
}

function learn(train: BoxRow[], features: string[]): Rule[] {
  const conds = candidates(train, features);
  const rules: Rule[] = [];
  let pool = train;
  for (let round = 0; round < MAX_RULES; round += 1) {
    const bits = conds.map((c) => pool.map((r) => holds(r, c)));
    let best: { rule: Rule; gain: number } | null = null;
    const judge = (rule: Rule, covered: boolean[]) => {
      let junk = 0;
      let notes = 0;
      const walls = new Set<string>();
      covered.forEach((on, i) => {
        if (!on) return;
        const r = pool[i]!;
        if (r.note) notes += 1;
        else {
          junk += 1;
          walls.add(r.wall);
        }
      });
      if (junk < MIN_SUPPORT || walls.size < MIN_WALLS || notes > MAX_TRAIN_NOTES) return;
      const gain = junk - NOTE_COST * notes;
      if (gain > 0 && (!best || gain > best.gain)) best = { rule, gain };
    };
    for (let a = 0; a < conds.length; a += 1) {
      judge([conds[a]!], bits[a]!);
      if (!PAIRS) continue;
      for (let b = a + 1; b < conds.length; b += 1) {
        if (conds[b]!.f === conds[a]!.f) continue;
        judge(
          [conds[a]!, conds[b]!],
          bits[a]!.map((v, i) => v && bits[b]![i]!),
        );
      }
    }
    if (!best) break;
    let chosen: Rule = (best as { rule: Rule }).rule;
    // A single threshold is placed in the MIDDLE of the run of thresholds
    // that score as well as the best, not at its edge: the edge is where the
    // nearest training note or junk box happened to fall.
    if (chosen.length === 1) {
      const c0 = chosen[0]!;
      const gainOf = (c: Cond) => {
        const covered = pool.filter((r) => holds(r, c));
        const n = covered.filter((r) => r.note).length;
        return n > MAX_TRAIN_NOTES ? -1 : covered.length - n - NOTE_COST * n;
      };
      const top = gainOf(c0);
      const ties = conds
        .filter((c) => c.f === c0.f && c.lt === c0.lt && gainOf(c) === top)
        .map((c) => c.t)
        .sort((a, b) => a - b);
      chosen = [{ ...c0, t: (ties[0]! + ties[ties.length - 1]!) / 2 }];
    }
    rules.push(chosen);
    pool = pool.filter((r) => !fires(r, chosen));
  }
  return rules;
}

function main() {
  // `--pre <expr>`: a gate already applied, so the rules learn what is left.
  const pre = process.argv.includes('--pre')
    ? (new Function('f', `return ${process.argv[process.argv.indexOf('--pre') + 1]}`) as (
        f: Record<string, number>,
      ) => boolean)
    : () => false;
  const all = collectRows();
  const preRemoved = all.filter((r) => pre(r.f));
  const rows = all.filter((r) => !pre(r.f));
  console.log(
    `pre-gate removed ${preRemoved.filter((r) => !r.note).length} junk/paper, ${preRemoved.filter((r) => r.note).length} notes`,
  );
  const features = ONLY ?? Object.keys(rows[0]!.f);
  const walls = [...new Set(rows.map((r) => r.wall))];
  let junkOut = 0;
  let notesOut = 0;
  let detected = 0;
  let matched = 0;
  console.log(
    `cost ${NOTE_COST}, walls ${MIN_WALLS}, rules ${MAX_RULES}, support ${MIN_SUPPORT}, pairs ${PAIRS}`,
  );
  for (const wall of walls) {
    // Paper boxes (fitting faults over a real note) are neither notes nor
    // junk, so they teach nothing about junk and are left out of fitting.
    const train = rows.filter((r) => r.wall !== wall && !r.paper);
    const held = rows.filter((r) => r.wall === wall);
    const rules = learn(train, features);
    const gone = held.filter((r) => rules.some((rule) => fires(r, rule)));
    const j = gone.filter((r) => !r.note).length;
    const pj = gone.filter((r) => r.paper).length;
    const offJunk = held.filter((r) => !r.note && !r.paper).length;
    const n = gone.filter((r) => r.note).length;
    junkOut += j;
    notesOut += n;
    const m = held.filter((r) => r.note).length;
    detected += held.length - j - n;
    matched += m - n;
    const precBefore = m / held.length;
    const precAfter = (m - n) / (held.length - j - n);
    console.log(
      `${wall.padEnd(20)} junk ${String(j - pj).padStart(2)}/${String(offJunk).padStart(2)} + paper ${pj} removed, notes lost ${n}` +
        `   prec ${(precBefore * 100).toFixed(0)}% -> ${(precAfter * 100).toFixed(0)}%`,
    );
    for (const rule of rules) console.log(`    ${show(rule)}`);
  }
  const truth = labelledNotes();
  const p = matched / detected;
  const rc = matched / truth;
  console.log(
    `\nTOTAL junk removed ${junkOut}, notes lost ${notesOut}; precision ${(p * 100).toFixed(1)}% recall ${(rc * 100).toFixed(1)}% F1 ${((200 * p * rc) / (p + rc)).toFixed(1)}%`,
  );
}

main();
