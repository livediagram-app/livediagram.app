import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';
import { gzipSync } from 'node:zlib';
import { quantiseWeights, type WeightSpec } from '../../src/quantise';
import { WORK_DIR } from '../paths';
import { WEIGHTS_DIR } from './weights';

// The boundary model's weights in a byte each (experiment J4), as a
// TensorFlow.js model folder the browser loads unchanged:
//
//   npx tsx scripts/hybrid/quantise.ts [--from <dir>] [--to <dir>] [--min-elements 256]
//
// Then score it: STICKY_MODEL_WEIGHTS=<to> npx tsx scripts/hybrid/sweep.ts --kept

const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1]!;
};
const from = arg('from', WEIGHTS_DIR);
const to = arg('to', `${WORK_DIR}/models/${basename(from)}-int8`);
const minElements = Number(arg('min-elements', '256'));

type Manifest = { paths: string[]; weights: WeightSpec[] }[];
const model = JSON.parse(readFileSync(`${from}/model.json`, 'utf8')) as {
  weightsManifest: Manifest;
};
if (model.weightsManifest.length !== 1) throw new Error('expected one weights group');
const group = model.weightsManifest[0]!;
const bin = readFileSync(`${from}/${group.paths[0]!}`);
const data = bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength);
const out = quantiseWeights(group.weights, data, { minElements });

mkdirSync(to, { recursive: true });
writeFileSync(`${to}/weights.bin`, new Uint8Array(out.data));
const manifest: Manifest = [{ paths: ['weights.bin'], weights: out.specs }];
const json = JSON.stringify({ ...model, weightsManifest: manifest });
writeFileSync(`${to}/model.json`, json);

const kb = (n: number) => `${(n / 1024).toFixed(0)} KB`;
const quantised = out.specs.filter((s) => s.quantization).length;
console.log(
  `${to}: ${quantised}/${out.specs.length} tensors in uint8; weights ${kb(bin.byteLength)} -> ${kb(out.data.byteLength)}` +
    ` (gzip ${kb(gzipSync(new Uint8Array(out.data)).byteLength)}), model.json ${kb(json.length)}` +
    ` (gzip ${kb(gzipSync(json).byteLength)})`,
);
