import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { FLAT_CHANCE, syntheticWall, type WallStyle } from '../src/synth/wall';
import { shardPath, writeShard, type ShardMeta } from './data/shards';
import { WORK_DIR } from './paths';

// Generate a synthetic training set in parallel:
//
//   npx tsx scripts/gen-synth.ts [--count 12000] [--size 256] [--seed 1] [--workers 16] [--out dir]
//     [--style photo|flat] [--flat-chance 0.2]
//
// Each seed draws its own style (photo, or flat one time in five) unless
// `--style` forces one.
// Seeds run from --seed upward, so a set is reproducible from its meta.json.

const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1]!;
};
const size = Number(arg('size', '256'));
const PER_SHARD = 250;
const style = arg('style', '') as WallStyle | '';
const flatChance = Number(arg('flat-chance', String(FLAT_CHANCE)));

if (process.argv.includes('--worker')) {
  const shard = Number(arg('shard', '0'));
  const firstSeed = Number(arg('seed', '1'));
  const out = arg('out', '');
  const tiles = [];
  for (let i = 0; i < PER_SHARD; i += 1) {
    const w = syntheticWall(firstSeed + shard * PER_SHARD + i, size, size, {
      style: style || undefined,
      flatChance,
    });
    tiles.push({ width: size, height: size, rgb: w.rgb, classes: w.classes });
  }
  writeShard(shardPath(out, shard), tiles);
} else {
  const count = Number(arg('count', '12000'));
  const firstSeed = Number(arg('seed', '1'));
  const workers = Number(arg('workers', '16'));
  const out = arg('out', `${WORK_DIR}/synth-${size}-s${firstSeed}`);
  mkdirSync(out, { recursive: true });
  const shards = Math.ceil(count / PER_SHARD);
  const todo = Array.from({ length: shards }, (_, i) => i).filter(
    (i) => !existsSync(shardPath(out, i)),
  );
  const self = fileURLToPath(import.meta.url);
  const started = performance.now();
  let done = shards - todo.length;
  const next = (): Promise<void> => {
    const shard = todo.shift();
    if (shard === undefined) return Promise.resolve();
    return new Promise<void>((resolve, reject) => {
      const child = spawn(
        process.execPath,
        [
          ...process.execArgv,
          self,
          '--worker',
          '--shard',
          String(shard),
          '--seed',
          String(firstSeed),
          '--size',
          String(size),
          '--out',
          out,
          ...(style ? ['--style', style] : []),
          '--flat-chance',
          String(flatChance),
        ],
        { stdio: 'inherit' },
      );
      child.on('exit', (code) => {
        if (code !== 0) return reject(new Error(`shard ${shard} failed with ${code}`));
        done += 1;
        console.log(
          `shard ${shard} done (${done}/${shards}) ${((performance.now() - started) / 1000).toFixed(0)}s`,
        );
        resolve(next());
      });
    });
  };
  await Promise.all(Array.from({ length: workers }, next));
  const meta: ShardMeta = { size, perShard: PER_SHARD, shards, firstSeed };
  writeFileSync(`${out}/meta.json`, JSON.stringify(meta));
  console.log(`wrote ${shards * PER_SHARD} tiles to ${out}`);
}
