import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { rngFrom } from '../src/synth/rng';
import type { TileSource } from '../src/train/tile';
import { makeBatch } from './data/batch';
import { loadRealWalls } from './data/real';
import { readShard, shardPath, type ShardMeta } from './data/shards';
import { tf } from './model/tf';
import { buildUNet, DEFAULT_UNET, weightedCrossEntropy, type UNetConfig } from './model/unet';
import { WORK_DIR } from './paths';

// Train the boundary model (experiment E2):
//
//   npx tsx scripts/train.ts --out <dir> [--synth dir[,dir]] [--real all|none]
//     [--exclude <wall>] [--init <dir>] [--steps 4000] [--batch 16] [--lr 2e-3]
//     [--lr-end 1e-4] [--real-fraction 0.5] [--weights 1,1,3] [--widths 16,24,40,64,96]
//
// `--exclude` leaves one real wall out, so a model is never scored on a wall
// it was trained on. Weights land under the system temp directory by default.

const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1]!;
};

const out = arg('out', `${WORK_DIR}/models/run`);
const steps = Number(arg('steps', '4000'));
const batch = Number(arg('batch', '16'));
const lr0 = Number(arg('lr', '2e-3'));
const lrEnd = Number(arg('lr-end', '1e-4'));
const size = Number(arg('size', '256'));
const realFraction = Number(arg('real-fraction', '0.5'));
const classWeights = arg('weights', '1,1,3').split(',').map(Number);
const widths = arg('widths', DEFAULT_UNET.widths.join(','))
  .split(',')
  .map(Number) as UNetConfig['widths'];
const exclude = arg('exclude', '');
const realMode = arg('real', 'none');
const seed = Number(arg('seed', '1'));
const init = arg('init', '');

function loadSynth(): TileSource[] {
  const dirs = arg('synth', '').split(',').filter(Boolean);
  return dirs.flatMap((dir) => {
    const meta = JSON.parse(readFileSync(`${dir}/meta.json`, 'utf8')) as ShardMeta;
    if (meta.size !== size)
      throw new Error(`${dir} holds ${meta.size}px tiles, training at ${size}`);
    return Array.from({ length: meta.shards }, (_, i) => readShard(shardPath(dir, i), size)).flat();
  });
}

const synth = loadSynth();
const real = realMode === 'all' ? loadRealWalls().filter((w) => w.name !== exclude) : [];
console.log(
  `synthetic tiles ${synth.length}, real walls ${real.map((w) => w.name).join(' ') || 'none'}` +
    (exclude ? ` (left out: ${exclude})` : ''),
);
if (synth.length === 0 && real.length === 0) throw new Error('nothing to train on');

const model = init ? await tf.loadLayersModel(`file://${init}/model.json`) : buildUNet({ widths });
console.log(`params ${model.countParams()}  ${init ? `from ${init}` : 'fresh'}`);
const optimizer = tf.train.adam(lr0);
model.compile({ optimizer, loss: weightedCrossEntropy });

mkdirSync(out, { recursive: true });
writeFileSync(
  `${out}/train.json`,
  JSON.stringify({
    steps,
    batch,
    lr0,
    lrEnd,
    size,
    realFraction,
    classWeights,
    widths,
    exclude,
    realMode,
    init,
    seed,
    synth: arg('synth', ''),
  }),
);
const rng = rngFrom(seed);
const spec = {
  size,
  batch,
  realFraction,
  classWeights,
  realScale: [0.7, 1.45] as [number, number],
};
const started = performance.now();
let window = 0;
let windowSteps = 0;
for (let step = 1; step <= steps; step += 1) {
  // Cosine decay from lr0 to lrEnd.
  const lr = lrEnd + 0.5 * (lr0 - lrEnd) * (1 + Math.cos((Math.PI * (step - 1)) / steps));
  (optimizer as unknown as { learningRate: number }).learningRate = lr;
  const { x, y } = makeBatch(synth, real, spec, rng);
  const xs = tf.tensor4d(x, [batch, size, size, 3]);
  const ys = tf.tensor4d(y, [batch, size, size, 3]);
  const loss = (await model.trainOnBatch(xs, ys)) as number;
  xs.dispose();
  ys.dispose();
  window += loss;
  windowSteps += 1;
  if (step % 25 === 0 || step === steps) {
    const secs = (performance.now() - started) / 1000;
    console.log(
      `step ${step}/${steps} loss ${(window / windowSteps).toFixed(4)} lr ${lr.toExponential(2)} ${(secs / step).toFixed(2)}s/step`,
    );
    window = 0;
    windowSteps = 0;
  }
  if (step % 250 === 0 || step === steps) await model.save(`file://${out}`);
}
console.log(`saved ${out}${existsSync(`${out}/model.json`) ? '' : ' (MISSING)'}`);
