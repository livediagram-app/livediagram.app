import { CLASS_COUNT } from '../../src/mask';
import type { Rng } from '../../src/synth/rng';
import { IGNORE, sampleTile, type TileSource } from '../../src/train/tile';

// One training batch: tiles drawn from synthetic shards and real walls,
// flipped and turned at random, real tiles also zoomed and re-lit. The target
// is one-hot scaled by the class weight, all zeros where the pixel is IGNORE.

export type BatchSpec = {
  size: number;
  batch: number;
  realFraction: number;
  classWeights: readonly number[];
  realScale: [number, number];
};

export function makeBatch(
  synth: readonly TileSource[],
  real: readonly TileSource[],
  spec: BatchSpec,
  rng: Rng,
): { x: Float32Array; y: Float32Array } {
  const { size, batch } = spec;
  const px = size * size;
  const x = new Float32Array(batch * px * 3);
  const y = new Float32Array(batch * px * CLASS_COUNT);
  for (let b = 0; b < batch; b += 1) {
    const useReal = real.length > 0 && (synth.length === 0 || rng.chance(spec.realFraction));
    const src = useReal ? rng.pick(real) : rng.pick(synth);
    const scale = useReal ? rng.logRange(...spec.realScale) : 1;
    const span = size / scale;
    const tile = sampleTile(src, size, {
      originX: rng.range(-span * 0.1, Math.max(0, src.width - span * 0.9)),
      originY: rng.range(-span * 0.1, Math.max(0, src.height - span * 0.9)),
      scale,
      transform: rng.int(0, 7),
    });
    const gain = useReal ? rng.range(0.75, 1.25) : 1;
    const tint = useReal
      ? [rng.range(0.93, 1.07), rng.range(0.95, 1.05), rng.range(0.93, 1.07)]
      : [1, 1, 1];
    for (let p = 0; p < px; p += 1) {
      for (let c = 0; c < 3; c += 1) {
        x[(b * px + p) * 3 + c] = Math.min(1, (tile.rgb[p * 3 + c]! / 255) * gain * tint[c]!);
      }
      const k = tile.classes[p]!;
      if (k === IGNORE) continue;
      y[(b * px + p) * CLASS_COUNT + k] = spec.classWeights[k]!;
    }
  }
  return { x, y };
}
