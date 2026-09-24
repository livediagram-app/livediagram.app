import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import type { ImageBuffer } from '../../../sticky-vision/src/colour';
import { listPhotos, loadPhoto } from '../../../sticky-vision/scripts/photos';
import { photoDir, truthFor, type Truth } from '../../../sticky-vision/scripts/truth';
import { predictProbs } from '../model/infer';
import { tf } from '../model/tf';
import { WORK_DIR } from '../paths';
import { WEIGHTS_DIR } from './weights';

export { WEIGHTS_DIR };

// The eight labelled walls at the editor's working size (the sweep's own
// Chromium pixels, cached by `sticky-vision/scripts/calibrate.ts`), each with
// the boundary model's probabilities. Predicting takes a quarter of a second a
// wall, so the probabilities are cached beside the model's other outputs under
// the temp directory: they are derived from the private photos and never
// belong in the repo.

export type HybridWall = { name: string; image: ImageBuffer; truth: Truth; probs: Float32Array };

export async function loadHybridWalls(): Promise<HybridWall[]> {
  const dir = photoDir();
  const cacheDir = `${WORK_DIR}/hybrid-probs/${WEIGHTS_DIR.replace(/[^a-z0-9]+/gi, '_')}`;
  mkdirSync(cacheDir, { recursive: true });
  let model: Awaited<ReturnType<typeof tf.loadLayersModel>> | null = null;
  const walls: HybridWall[] = [];
  for (const name of listPhotos(dir)) {
    const truth = truthFor(name);
    if (!truth) continue;
    const image = loadPhoto(dir, name);
    const cache = `${cacheDir}/${name}.${image.width}x${image.height}.f32`;
    let probs: Float32Array;
    if (existsSync(cache)) {
      probs = new Float32Array(new Uint8Array(readFileSync(cache)).buffer);
    } else {
      model ??= await tf.loadLayersModel(`file://${WEIGHTS_DIR}/model.json`);
      probs = predictProbs(model, image.data, image.width, image.height);
      writeFileSync(cache, Buffer.from(probs.buffer));
    }
    walls.push({ name, image, truth, probs });
  }
  return walls;
}
