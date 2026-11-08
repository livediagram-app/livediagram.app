// Props equal for a memoised character view (docs/specs/008-canvas/canvas-performance.md "Walking renders the
// characters, not the canvas"): each the same value, or a plain object (a position, a costume, a reaction pose, a
// ring) with the same fields. Callers build those afresh every render (a peer's position and parsed costume from their
// latest packet), and only a real change should draw a few hundred SVG nodes again.
export function propsEqualByField<P extends object>(prev: P, next: P): boolean {
  const keys = new Set([...Object.keys(prev), ...Object.keys(next)]) as Set<keyof P>;
  for (const key of keys) {
    const a: unknown = prev[key];
    const b: unknown = next[key];
    if (a === b) continue;
    if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
    const ra = a as Record<string, unknown>;
    const rb = b as Record<string, unknown>;
    const fields = Object.keys(ra);
    if (fields.length !== Object.keys(rb).length) return false;
    for (const f of fields) if (ra[f] !== rb[f]) return false;
  }
  return true;
}
