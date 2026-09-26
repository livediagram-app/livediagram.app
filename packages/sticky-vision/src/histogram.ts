// Statistics over a 101-bucket histogram of a 0..1 quantity, the shape every
// floor in `floors.ts` is measured in.

// Otsu's threshold over a histogram: the cut that minimises the variance
// within the two groups it makes. Returned in the histogram's own units
// (0..1 here, 101 buckets), with the strength of the split — how much of the
// spread that cut actually explains — so a caller can tell a real two-surface
// histogram from one blurry hill.
export function otsu(buckets: Int32Array): { at: number; strength: number } {
  let total = 0;
  let sum = 0;
  for (let i = 0; i < buckets.length; i += 1) {
    total += buckets[i]!;
    sum += i * buckets[i]!;
  }
  if (total === 0) return { at: 0, strength: 0 };
  const mean = sum / total;
  let variance = 0;
  for (let i = 0; i < buckets.length; i += 1) variance += buckets[i]! * (i - mean) ** 2;
  variance /= total;
  let backgroundWeight = 0;
  let backgroundSum = 0;
  let best = 0;
  let bestAt = 0;
  for (let i = 0; i < buckets.length; i += 1) {
    backgroundWeight += buckets[i]!;
    if (backgroundWeight === 0) continue;
    const foregroundWeight = total - backgroundWeight;
    if (foregroundWeight === 0) break;
    backgroundSum += i * buckets[i]!;
    const backgroundMean = backgroundSum / backgroundWeight;
    const foregroundMean = (sum - backgroundSum) / foregroundWeight;
    const between =
      (backgroundWeight / total) *
      (foregroundWeight / total) *
      (backgroundMean - foregroundMean) ** 2;
    if (between > best) {
      best = between;
      bestAt = i;
    }
  }
  return { at: bestAt / 100, strength: variance > 0 ? best / variance : 0 };
}

// The MODE, not the median. The wall is the one surface the whole frame is
// mostly made of, and the mode finds it whether it covers 90% of the photo or
// 55% — a median is dragged upwards by a densely covered wall, which is
// exactly the case where the paper and the wall are hardest to tell apart (on
// a real photo it put the floor above the notes' own saturation and the
// detector found a sixth of them).
//
// Smoothed over a small window, because a histogram of a photograph is noisy
// and the true peak is a hill rather than a spike.
export function modeOf(buckets: Int32Array): number {
  const window = 3;
  let bestAt = 0;
  let best = -1;
  for (let i = 0; i < buckets.length; i += 1) {
    let sum = 0;
    for (let j = Math.max(0, i - window); j <= Math.min(buckets.length - 1, i + window); j += 1) {
      sum += buckets[j]!;
    }
    if (sum > best) {
      best = sum;
      bestAt = i;
    }
  }
  return bestAt / 100;
}
