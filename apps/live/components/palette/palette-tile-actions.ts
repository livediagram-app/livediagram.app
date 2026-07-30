// Wrap a palette tile-action bundle so every add runs a preamble first
// (spec/101): picking any tile while Avatar mode is active leaves the mode, so
// the element actually lands instead of the click being swallowed by a
// read-only canvas.
//
// Done as one wrapper over the whole bundle rather than per handler, so tiles
// added later inherit it for free. Non-function entries (the `hasImage` flag)
// pass through untouched.

export function withTileActionPreamble<T extends Record<string, unknown>>(
  actions: T,
  preamble: () => void,
): T {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(actions)) {
    out[key] =
      typeof value === 'function'
        ? (...args: unknown[]) => {
            preamble();
            return (value as (...a: unknown[]) => unknown)(...args);
          }
        : value;
  }
  return out as T;
}
