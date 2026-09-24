import { classMaskOf, detectStickies } from '../../../sticky-vision/src/detect';
import { score } from '../../../sticky-vision/scripts/truth';
import { cuesOf } from '../../src/cues';
import { loadHybridWalls } from './walls';

// What the boundary model sees where the classical detector goes wrong: the
// ceiling on each hybrid rule before any rule is written (experiment J0).
//
//   npx tsx scripts/hybrid/probe.ts [--t 0.4] [--min-core 12]
//
// Per wall: for every classical box that holds two labelled notes, how many
// model cores sit inside it (J1's split); for every missed note, whether the
// model has a note there, and whether the classical detector has paper under
// it (J2's add); for every spurious box and every correct one, the model's
// mean background probability over its middle (J3's drop, and what it would
// cost). Positions only, never pixels.

const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1]!;
};
const t = Number(arg('t', '0.4'));
const minCore = Number(arg('min-core', '12'));

type R = { x: number; y: number; w: number; h: number };
const cx = (r: R) => r.x + r.w / 2;
const cy = (r: R) => r.y + r.h / 2;
const holds = (b: R, x: number, y: number) =>
  x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
const at = (r: R) =>
  `${Math.round(cx(r))},${Math.round(cy(r))} ${Math.round(r.w)}x${Math.round(r.h)}`;

for (const wall of await loadHybridWalls()) {
  const { width, height } = wall.image;
  const found = detectStickies(wall.image);
  const s = score(wall.truth, found, width, height);
  const cues = cuesOf(wall.probs, width, height, { coreThreshold: t, minCorePixels: minCore });
  const mask = classMaskOf(wall.image);
  const labels = wall.truth.notes.map((n) => ({
    x: n.x * width,
    y: n.y * height,
    w: n.w * width,
    h: n.h * height,
  }));
  const bgOf = (b: R) => {
    let sum = 0;
    let n = 0;
    for (let y = Math.round(b.y + b.h * 0.25); y < b.y + b.h * 0.75; y += 1)
      for (let x = Math.round(b.x + b.w * 0.25); x < b.x + b.w * 0.75; x += 1) {
        sum += cues.background[y * width + x]!;
        n += 1;
      }
    return n ? sum / n / 255 : 1;
  };
  const paperOf = (b: R) => {
    let paper = 0;
    let n = 0;
    for (let y = Math.max(0, Math.round(b.y)); y < Math.min(height, b.y + b.h); y += 1)
      for (let x = Math.max(0, Math.round(b.x)); x < Math.min(width, b.x + b.w); x += 1) {
        if (mask.classes[y * width + x]! > 0) paper += 1;
        n += 1;
      }
    return n ? paper / n : 0;
  };
  const coresIn = (b: R) => cues.notes.filter((m) => holds(b, cx(m.core), cy(m.core)));
  const matchesLabel = (m: R, l: R) =>
    Math.hypot(cx(m) - cx(l), cy(m) - cy(l)) <= Math.max(l.w, l.h) * 0.5 &&
    (m.w * m.h) / (l.w * l.h) <= 2 &&
    (m.w * m.h) / (l.w * l.h) >= 0.5;

  console.log(
    `\n${wall.name}  classical ${found.length} (merged ${s.merged}, spurious ${s.spurious.length}, missed ${s.missed.length})  model notes ${cues.notes.length}`,
  );
  const spurious = new Set(s.spurious);
  for (const b of found) {
    const held = labels.filter((l) => holds(b, cx(l), cy(l)));
    if (held.length < 2) continue;
    const cores = coresIn(b);
    const inseparable = held.some((a) =>
      held.some(
        (c) => a !== c && Math.abs(cx(a) - cx(c)) <= c.w / 2 && Math.abs(cy(a) - cy(c)) <= c.h / 2,
      ),
    );
    console.log(
      `  merged ${at(b)} holds ${held.length}${inseparable ? ' (inseparable)' : ''}${spurious.has(b) ? ' REAL' : ''}` +
        `  cores ${cores.length}: ${cores.map((m) => `${at(m)} c${m.confidence.toFixed(2)} ${m.corePixels}px`).join('  ')}`,
    );
  }
  for (const n of s.missed) {
    const l = { x: n.x * width, y: n.y * height, w: n.w * width, h: n.h * height };
    const model = cues.notes.find((m) => matchesLabel(m, l));
    const under = found.find((b) => holds(b, cx(l), cy(l)));
    console.log(
      `  missed ${at(l)} ${n.kind.padEnd(15)} model ${model ? `${at(model)} c${model.confidence.toFixed(2)} ${model.corePixels}px` : '-'}` +
        `  paper ${(paperOf(l) * 100).toFixed(0)}%  in-box ${under ? at(under) : '-'}`,
    );
  }
  for (const b of s.spurious) {
    const held = labels.filter((l) => holds(b, cx(l), cy(l))).length;
    if (held >= 2) continue;
    console.log(
      `  spurious ${at(b)} bg ${bgOf(b).toFixed(2)} cores ${coresIn(b).length} holds ${held}`,
    );
  }
  const median =
    found.map((b) => b.w * b.h).sort((a, b) => a - b)[Math.floor(found.length / 2)] ?? 1;
  for (const b of found) {
    const cores = coresIn(b);
    if (spurious.has(b) || cores.length < 2) continue;
    console.log(
      `  correct ${at(b)} cores ${cores.length}: ` +
        cores
          .map(
            (m) =>
              `${at(m)} c${m.confidence.toFixed(2)} ${m.corePixels}px a${((m.w * m.h) / median).toFixed(2)}`,
          )
          .join('  '),
    );
  }
  const trueBg = found
    .filter((b) => !spurious.has(b))
    .map(bgOf)
    .sort((a, b) => b - a);
  console.log(
    `  correct boxes' bg, highest: ${trueBg
      .slice(0, 6)
      .map((v) => v.toFixed(2))
      .join(' ')}` +
      `   with >=2 cores: ${found.filter((b) => !spurious.has(b) && coresIn(b).length >= 2).length}`,
  );
}
