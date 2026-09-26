import { statSync } from 'node:fs';
import { predictProbs } from './model/infer';
import { tf } from './model/tf';

// How long the model takes on one working-size photograph, and how big it
// is on disk:  npx tsx scripts/time-model.ts <model dir> [width] [height]

const dir = process.argv[2]!;
const width = Number(process.argv[3] ?? 1000);
const height = Number(process.argv[4] ?? 563);
const model = await tf.loadLayersModel(`file://${dir}/model.json`);
const rgba = new Uint8ClampedArray(width * height * 4).map((_, i) => (i * 7919) % 256);
predictProbs(model, rgba, width, height);
const runs: number[] = [];
for (let i = 0; i < 10; i += 1) {
  const started = performance.now();
  predictProbs(model, rgba, width, height);
  runs.push(performance.now() - started);
}
runs.sort((a, b) => a - b);
const bytes = statSync(`${dir}/weights.bin`).size;
console.log(
  `${tf.getBackend()} ${process.env.STICKY_MODEL_GPU === '1' ? 'GPU' : 'CPU'}  ${width}x${height}` +
    `  median ${runs[5]!.toFixed(0)} ms  (min ${runs[0]!.toFixed(0)})  params ${model.countParams()}` +
    `  weights ${(bytes / 1024).toFixed(0)} KB fp32`,
);
