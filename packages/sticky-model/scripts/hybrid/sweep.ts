import { HYBRID_RULES, type HybridRules } from '../../../sticky-vision/src/hybrid';
import { detectStickies } from '../../../sticky-vision/src/detect';
import { score } from '../../../sticky-vision/scripts/truth';
import { CUE_OPTIONS, cuesOf } from '../../src/cues';
import { mergedFloorOf, realMergedOf, table, totals, type Row } from '../report';
import { loadHybridWalls, type HybridWall } from './walls';

// The hybrid detector scored with the classical sweep's own scorer and bar
// (experiment group J): the classical pipeline, corrected by the boundary
// model's cues where the rules given allow.
//
//   npx tsx scripts/hybrid/sweep.ts [--t 0.4] [--min-core 12]
//     [--split conf,area] [--add conf,area,paper] [--drop background]
//     [--pad conf,paper,sizeRatio,reach,siblings]
//     [--grid split|add|drop|pad] [--kept]
//
// `--kept` starts from the kept rules (HYBRID_RULES). With no rule the table is the classical detector's own (the baseline, to
// read beside). `--grid` prints one TOTAL line per setting of that rule, with
// the other rules as given, and the per-wall F1 so a wall that pays is seen.

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1]!;
};
const nums = (name: string) => arg(name)?.split(',').map(Number);
const t = Number(arg('t') ?? CUE_OPTIONS.coreThreshold);
const minCore = Number(arg('min-core') ?? CUE_OPTIONS.minCorePixels);

function rulesFromArgs(): HybridRules {
  const rules: HybridRules = process.argv.includes('--kept') ? { ...HYBRID_RULES } : {};
  const split = nums('split');
  if (split) rules.split = { minConfidence: split[0]!, minAreaOfMedian: split[1]! };
  const add = nums('add');
  if (add)
    rules.add = {
      minConfidence: add[0]!,
      minAreaOfMedian: add[1]!,
      minPaper: add[2]!,
    };
  const pad = nums('pad');
  if (pad)
    rules.pad = {
      minConfidence: pad[0]!,
      minPaper: pad[1]!,
      sizeRatio: pad[2]!,
      reach: pad[3]!,
      minSiblings: pad[4]!,
    };
  const drop = nums('drop');
  if (drop) rules.drop = { minBackground: drop[0]! };
  return rules;
}

const walls = await loadHybridWalls();
const cues = new Map(
  walls.map((w) => [
    w,
    cuesOf(w.probs, w.image.width, w.image.height, { coreThreshold: t, minCorePixels: minCore }),
  ]),
);

function rowOf(wall: HybridWall, rules: HybridRules): Row {
  const { width, height } = wall.image;
  const started = performance.now();
  const found = detectStickies(wall.image, { model: { cues: cues.get(wall)!, rules } });
  const ms = performance.now() - started;
  const s = score(wall.truth, found, width, height);
  const labels = wall.truth.notes.map((n) => ({
    x: n.x * width,
    y: n.y * height,
    w: n.w * width,
    h: n.h * height,
  }));
  return {
    name: wall.name.replace(/\.[^.]+$/, ''),
    score: s,
    ms,
    realMerged: realMergedOf(s, labels),
    floor: mergedFloorOf(labels),
  };
}

const base = rulesFromArgs();
const grid = arg('grid');
if (!grid) {
  console.log(`cues: t ${t}, minCore ${minCore}   rules: ${JSON.stringify(base)}`);
  console.log(table(walls.map((w) => rowOf(w, base))));
} else {
  const settings: HybridRules[] = [];
  if (grid === 'split')
    for (const c of [0.7, 0.75, 0.8, 0.85, 0.9])
      for (const a of [0.1, 0.2, 0.3, 0.5])
        settings.push({ ...base, split: { minConfidence: c, minAreaOfMedian: a } });
  if (grid === 'add')
    for (const c of [0.65, 0.7, 0.75, 0.8, 0.85])
      for (const a of [0.1, 0.2, 0.3, 0.4])
        for (const paper of [0.4, 0.5, 0.6])
          settings.push({
            ...base,
            add: { minConfidence: c, minAreaOfMedian: a, minPaper: paper },
          });
  // Each axis of the pad grid can be narrowed: --gc, --gp, --gs, --gr, --gn.
  if (grid === 'pad')
    for (const c of nums('gc') ?? [0.7, 0.75, 0.8])
      for (const p of nums('gp') ?? [0.5])
        for (const r of nums('gs') ?? [1.3, 1.5, 1.7])
          for (const reach of nums('gr') ?? [2, 3, 4])
            for (const k of nums('gn') ?? [2, 3])
              settings.push({
                ...base,
                pad: { minConfidence: c, minPaper: p, sizeRatio: r, reach, minSiblings: k },
              });
  if (grid === 'drop')
    for (const b of [0.6, 0.7, 0.8, 0.85, 0.9, 0.95, 0.97, 0.99])
      settings.push({ ...base, drop: { minBackground: b } });
  const pc = (v: number) => `${(v * 100).toFixed(1)}`.padStart(6);
  console.log(
    `cues: t ${t}, minCore ${minCore}; F1 per wall in the order ${walls.map((w) => w.name.slice(-6)).join(' ')}`,
  );
  for (const rules of settings) {
    const rows = walls.map((w) => rowOf(w, rules));
    const s = totals(rows);
    const setting = JSON.stringify(rules[grid as keyof HybridRules]);
    console.log(
      `${setting.padEnd(80)}${pc(s.f1)}${pc(s.precision)}${pc(s.recall)}${String(s.merged).padStart(4)}` +
        `${String(s.realMerged).padStart(3)} ${s.passing}/8 |` +
        rows
          .map((r) =>
            `${(r.score.f1 * 100).toFixed(0)}/${(r.score.recallWithoutActors * 100).toFixed(0)}`.padStart(
              7,
            ),
          )
          .join(''),
    );
  }
}
