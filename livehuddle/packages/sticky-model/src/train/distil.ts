import { CLASS_COUNT } from '../mask';

// Distillation targets: every pixel a tile teaches (any non-zero target)
// takes the teacher's probabilities instead, unweighted, so the student is
// pulled back to exactly what the teacher said there; a pixel past the tile's
// edge (all zeros) stays ignored. In place.
export function teacherTargets(y: Float32Array, taught: Float32Array): void {
  for (let o = 0; o < y.length; o += CLASS_COUNT) {
    let learnt = false;
    for (let k = 0; k < CLASS_COUNT; k += 1) if (y[o + k] !== 0) learnt = true;
    if (!learnt) continue;
    for (let k = 0; k < CLASS_COUNT; k += 1) y[o + k] = taught[o + k]!;
  }
}
