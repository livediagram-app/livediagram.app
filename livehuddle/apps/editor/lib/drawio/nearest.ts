// The nearest preset to a draw.io px value, shared by the stroke, corner and text mappings.

/** Nearest entry of a px table; ties go to the earlier (smaller) entry. */
export function nearest<K extends string>(
  table: Record<K, number>,
  keys: readonly K[],
  px: number,
): K {
  let best = keys[0]!;
  for (const k of keys) {
    if (Math.abs(table[k] - px) < Math.abs(table[best] - px)) best = k;
  }
  return best;
}
