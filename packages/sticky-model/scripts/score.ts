import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { classifyRgb, wallFloorsOf } from '../../sticky-vision/src';
import { encodePng } from '../../sticky-vision/scripts/png';
import { score, truthFor } from '../../sticky-vision/scripts/truth';
import { decodeBoxes, type DecodedBox, type DecodeMode } from '../src/decode';
import { loadRealWalls, type RealWall } from './data/real';
import { classesOf, predictProbs } from './model/infer';
import { tf, type TfNode } from './model/tf';
import { WORK_DIR } from './paths';
import { mergedFloorOf, realMergedOf, table, totals, type Row } from './report';

// Score the boundary model with the SAME scorer and bar as the classical sweep
// (experiment E3):
//
//   npx tsx scripts/score.ts --models <dir> [--mode core|grow] [--t 0.5]
//     [--min-core 12] [--sweep] [--overlay]
//
// With `<dir>/<wall>/model.json` present, each wall is scored by the model
// that was trained WITHOUT it (leave-one-wall-out); otherwise `<dir>/model.json`
// scores every wall. `--sweep` prints the TOTAL over a grid of decode settings
// from one set of predictions.

const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1]!;
};
const modelsDir = arg('models', `${WORK_DIR}/models/run`);

const modelCache = new Map<string, TfNode.LayersModel>();
async function modelFor(wall: string): Promise<TfNode.LayersModel> {
  const own = `${modelsDir}/${wall}/model.json`;
  const path = existsSync(own) ? own : `${modelsDir}/model.json`;
  if (!existsSync(path)) throw new Error(`no model for ${wall} in ${modelsDir}`);
  let model = modelCache.get(path);
  if (!model) {
    model = await tf.loadLayersModel(`file://${path}`);
    modelCache.set(path, model);
  }
  return model;
}

// The kind of a box by majority vote of the classical classifier over its
// middle: the model finds paper, the notation's colours say which paper.
function kindOf(wall: RealWall, floors: ReturnType<typeof wallFloorsOf>, box: DecodedBox): string {
  const votes = new Map<string, number>();
  const x0 = Math.round(box.x + box.w * 0.25);
  const y0 = Math.round(box.y + box.h * 0.25);
  for (let y = y0; y < box.y + box.h * 0.75; y += 2) {
    for (let x = x0; x < box.x + box.w * 0.75; x += 2) {
      if (x < 0 || y < 0 || x >= wall.width || y >= wall.height) continue;
      const i = (y * wall.width + x) * 4;
      const k = classifyRgb(wall.rgba[i]!, wall.rgba[i + 1]!, wall.rgba[i + 2]!, floors);
      if (k === 'wall' || k === 'ink' || k === 'unknown') continue;
      votes.set(k, (votes.get(k) ?? 0) + 1);
    }
  }
  return [...votes].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'domain-event';
}

type Decode = {
  mode: DecodeMode;
  t: number;
  minCore: number;
  minArea?: number;
};

function scoreWall(
  wall: RealWall,
  probs: Float32Array,
  d: Decode,
  ms: number,
): { row: Row; boxes: DecodedBox[] } {
  const classes = classesOf(probs, d.t);
  const boxes = decodeBoxes(classes, wall.width, wall.height, {
    mode: d.mode,
    minCorePixels: d.minCore,
    ...(d.minArea === undefined ? {} : { minAreaOfMedian: d.minArea }),
  });
  const floors = wallFloorsOf({ width: wall.width, height: wall.height, data: wall.rgba });
  const scored = boxes.map((b) => ({ ...b, kind: kindOf(wall, floors, b) }));
  const truth = truthFor(`${wall.name}.jpg`) ?? truthFor(`${wall.name}.png`);
  if (!truth) throw new Error(`no labels for ${wall.name}`);
  const result = score(truth, scored, wall.width, wall.height);
  return {
    row: {
      name: wall.name,
      score: result,
      ms,
      realMerged: realMergedOf(result, wall.boxes),
      floor: mergedFloorOf(wall.boxes),
    },
    boxes,
  };
}

function overlay(wall: RealWall, probs: Float32Array, boxes: DecodedBox[]): void {
  const data = new Uint8ClampedArray(wall.width * wall.height * 4);
  for (let p = 0; p < wall.width * wall.height; p += 1) {
    const grey = (wall.rgba[p * 4]! + wall.rgba[p * 4 + 1]! + wall.rgba[p * 4 + 2]!) / 6;
    data[p * 4] = grey + probs[p * 3 + 2]! * 127;
    data[p * 4 + 1] = grey + probs[p * 3 + 1]! * 127;
    data[p * 4 + 2] = grey;
    data[p * 4 + 3] = 255;
  }
  for (const b of boxes) {
    for (let x = b.x; x < b.x + b.w; x += 1) {
      for (const y of [b.y, b.y + b.h - 1]) {
        if (x >= 0 && y >= 0 && x < wall.width && y < wall.height)
          data.set([255, 255, 0, 255], (y * wall.width + x) * 4);
      }
    }
    for (let y = b.y; y < b.y + b.h; y += 1) {
      for (const x of [b.x, b.x + b.w - 1]) {
        if (x >= 0 && y >= 0 && x < wall.width && y < wall.height)
          data.set([255, 255, 0, 255], (y * wall.width + x) * 4);
      }
    }
  }
  // The labels as a dotted white frame, so a miss is a frame with no box on it.
  for (const b of wall.boxes) {
    const put = (x: number, y: number) => {
      const xi = Math.round(x);
      const yi = Math.round(y);
      if (xi >= 0 && yi >= 0 && xi < wall.width && yi < wall.height)
        data.set([255, 255, 255, 255], (yi * wall.width + xi) * 4);
    };
    for (let x = b.x; x < b.x + b.w; x += 3) {
      put(x, b.y);
      put(x, b.y + b.h - 1);
    }
    for (let y = b.y; y < b.y + b.h; y += 3) {
      put(b.x, y);
      put(b.x + b.w - 1, y);
    }
  }
  mkdirSync(`${WORK_DIR}/overlays`, { recursive: true });
  writeFileSync(
    `${WORK_DIR}/overlays/${wall.name}.png`,
    encodePng({ width: wall.width, height: wall.height, data }),
  );
}

// Where it went wrong, by position: each merged box with the labels inside it,
// and each missed label. Somewhere to go and look, not a percentage.
function list(wall: RealWall, boxes: DecodedBox[], row: Row): void {
  const at = (b: { x: number; y: number; w: number; h: number }) =>
    `${Math.round(b.x + b.w / 2)},${Math.round(b.y + b.h / 2)} ${Math.round(b.w)}x${Math.round(b.h)}`;
  console.log(`\n${wall.name}`);
  for (const b of boxes) {
    const inside = wall.boxes.filter((l) => {
      const cx = l.x + l.w / 2;
      const cy = l.y + l.h / 2;
      return cx >= b.x && cx <= b.x + b.w && cy >= b.y && cy <= b.y + b.h;
    });
    if (inside.length >= 2) console.log(`  merged ${at(b)} holds ${inside.map(at).join(' + ')}`);
  }
  const missed = row.score.missed.map((n) => ({
    x: n.x * wall.width,
    y: n.y * wall.height,
    w: n.w * wall.width,
    h: n.h * wall.height,
  }));
  console.log(`  missed (${missed.length}): ${missed.map(at).join('  ')}`);
}

const walls = loadRealWalls();
const predictions: { wall: RealWall; probs: Float32Array; ms: number }[] = [];
for (const wall of walls) {
  const model = await modelFor(wall.name);
  predictProbs(model, wall.rgba, wall.width, wall.height);
  const started = performance.now();
  const probs = predictProbs(model, wall.rgba, wall.width, wall.height);
  predictions.push({ wall, probs, ms: performance.now() - started });
}

const base: Decode = {
  mode: arg('mode', 'grow') as DecodeMode,
  t: Number(arg('t', '0.5')),
  minCore: Number(arg('min-core', '12')),
  ...(process.argv.includes('--min-area') ? { minArea: Number(arg('min-area', '0')) } : {}),
};

if (process.argv.includes('--sweep')) {
  const pc = (v: number) => `${(v * 100).toFixed(1)}%`;
  console.log(
    `  ${'mode'.padEnd(6)}${'t'.padStart(6)}${'minCore'.padStart(9)}${'minArea'.padStart(9)}` +
      `${'prec'.padStart(7)}${'recall'.padStart(8)}${'F1'.padStart(7)}${'merged'.padStart(8)}${'real'.padStart(6)}  walls`,
  );
  const grid: Decode[] = [];
  for (const mode of process.argv.includes('--mode') ? [base.mode] : (['grow'] as const)) {
    for (const t of [0.3, 0.4, 0.5, 0.6]) {
      for (const minCore of [12, 30, 45, 70, 100]) {
        grid.push({ mode, t, minCore });
        for (const minArea of [0.2, 0.3, 0.4, 0.5]) grid.push({ mode, t, minCore, minArea });
      }
    }
  }
  for (const d of grid) {
    const s = totals(predictions.map((p) => scoreWall(p.wall, p.probs, d, p.ms).row));
    console.log(
      `  ${d.mode.padEnd(6)}${d.t.toFixed(2).padStart(6)}${String(d.minCore).padStart(9)}${String(d.minArea ?? '-').padStart(9)}` +
        `${pc(s.precision).padStart(7)}${pc(s.recall).padStart(8)}${pc(s.f1).padStart(7)}${String(s.merged).padStart(8)}${String(s.realMerged).padStart(6)}  ${s.passing}/8`,
    );
  }
} else {
  const rows: Row[] = [];
  for (const p of predictions) {
    const { row, boxes } = scoreWall(p.wall, p.probs, base, p.ms);
    rows.push(row);
    if (process.argv.includes('--overlay')) overlay(p.wall, p.probs, boxes);
    if (process.argv.includes('--list')) list(p.wall, boxes, row);
  }
  console.log(`models: ${modelsDir}  decode: ${JSON.stringify(base)}`);
  console.log(table(rows));
}
