import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { listPhotos } from '../../sticky-vision/scripts/photos';
import { photoDir, truthFor } from '../../sticky-vision/scripts/truth';
import { stemOf } from './data/real';

// Leave-one-wall-out (experiment E2): one model per labelled wall, each
// trained on everything EXCEPT that wall, into `<out>/<wall>/`. `score.ts
// --models <out>` then scores every wall with the model that never saw it.
//
//   npx tsx scripts/lowo.ts --out <dir> [any train.ts flags]
//
// A wall whose model already exists is skipped, so an interrupted run resumes.

const i = process.argv.indexOf('--out');
if (i === -1) throw new Error('--out <dir> is required');
const out = process.argv[i + 1]!;
const passThrough = process.argv.slice(2).filter((_, k) => k !== i - 2 && k !== i - 1);
const train = fileURLToPath(new URL('./train.ts', import.meta.url));
const walls = listPhotos(photoDir())
  .filter((name) => truthFor(name))
  .map(stemOf);

for (const wall of walls) {
  const dir = `${out}/${wall}`;
  if (existsSync(`${dir}/model.json`) && existsSync(`${dir}/done`)) {
    console.log(`${wall}: done already`);
    continue;
  }
  console.log(`${wall}: training without it`);
  const run = spawnSync(
    process.execPath,
    [...process.execArgv, train, ...passThrough, '--real', 'all', '--exclude', wall, '--out', dir],
    { stdio: 'inherit' },
  );
  if (run.status !== 0) throw new Error(`${wall}: training failed (${run.status})`);
  spawnSync('touch', [`${dir}/done`]);
}
