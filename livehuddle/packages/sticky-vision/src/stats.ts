// The UPPER median on an even count, of a copy (the caller's array is never
// reordered), and 0 for no values. Upper, not lower: with a handful of boxes
// the difference decides everything. A photo of one note beside one speck has
// median 'speck' under the lower median, and every threshold derived from it
// then throws the note away.
export function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)]!;
}
