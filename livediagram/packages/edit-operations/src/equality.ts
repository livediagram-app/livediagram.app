// Value equality that ignores key order: normalising an element can reorder its keys without
// changing it, and that must read as no change (E1).

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (typeof value !== 'object' || value === null) return value;
  const record = value as Record<string, unknown>;
  return Object.fromEntries(
    Object.keys(record)
      .sort()
      .map((key) => [key, canonical(record[key])]),
  );
}

export function sameValue(a: unknown, b: unknown): boolean {
  return a === b || JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
}
