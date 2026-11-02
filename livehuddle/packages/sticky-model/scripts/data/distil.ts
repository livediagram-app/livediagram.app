import { CLASS_COUNT } from '../../src/mask';
import { teacherTargets } from '../../src/train/distil';
import type { Rng } from '../../src/synth/rng';
import type { TileSource } from '../../src/train/tile';
import { tf, type TfNode } from '../model/tf';
import { makeBatch, type BatchSpec } from './batch';

// A batch for teaching a trained model something new without unlearning what
// it knew ("learning without forgetting"): the NEW tiles (flat walls) carry
// their true masks, class-weighted as in training; the OLD tiles
// (photographed walls) carry the teacher's own probabilities, unweighted, so
// the student is pulled back to exactly what the teacher said wherever the
// old walls are concerned. Pixels past a tile's edge stay all zeros (ignored)
// in both.

export function distilBatch(
  teacher: TfNode.LayersModel,
  oldTiles: readonly TileSource[],
  newTiles: readonly TileSource[],
  spec: BatchSpec,
  newShare: number,
  rng: Rng,
): { x: Float32Array; y: Float32Array } {
  const { size, batch } = spec;
  const nNew = Math.round(batch * newShare);
  const nOld = batch - nNew;
  if (nNew < 1 || nOld < 1) throw new Error(`a batch of ${batch} cannot share ${newShare} new`);
  const px = size * size;
  const fresh = makeBatch(newTiles, [], { ...spec, batch: nNew }, rng);
  const old = makeBatch(oldTiles, [], { ...spec, batch: nOld, classWeights: [1, 1, 1] }, rng);
  const taught = tf.tidy(() => {
    const out = teacher.predict(tf.tensor4d(old.x, [nOld, size, size, 3])) as TfNode.Tensor;
    return out.dataSync() as Float32Array;
  });
  teacherTargets(old.y, taught);
  const x = new Float32Array(batch * px * 3);
  const y = new Float32Array(batch * px * CLASS_COUNT);
  x.set(fresh.x, 0);
  x.set(old.x, nNew * px * 3);
  y.set(fresh.y, 0);
  y.set(old.y, nNew * px * CLASS_COUNT);
  return { x, y };
}
