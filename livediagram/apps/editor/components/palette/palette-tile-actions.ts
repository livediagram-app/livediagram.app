// Wrap a palette tile-action bundle so every add runs a preamble first
// (docs/specs/008-canvas/avatar-mode.md): picking any tile while Avatar mode is active leaves the mode, so
// the element actually lands instead of the click being swallowed by a
// read-only canvas.
//
// Done as one wrapper over the whole bundle rather than per handler, so tiles
// added later inherit it for free. Non-function entries (the `hasImage` flag)
// pass through untouched.

export function withTileActionPreamble<T extends Record<string, unknown>>(
  actions: T,
  // Told which action and its arguments, for a preamble that depends on the tile (restoring a maximised element).
  preamble: (action: string, args: readonly unknown[]) => void,
): T {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(actions)) {
    out[key] =
      typeof value === 'function'
        ? (...args: unknown[]) => {
            preamble(key, args);
            return (value as (...a: unknown[]) => unknown)(...args);
          }
        : value;
  }
  return out as T;
}

// Whether picking this tile restores a maximised Plan element first (docs/specs/026-plan/plan-board.md "The palette
// follows what fills the screen"): every tile but a card (which lands on the maximised board) and cancelling a draw.
export function restoresMaximised(action: string, args: readonly unknown[]): boolean {
  if (action === 'cancelDraw') return false;
  return !(action === 'addShape' && args[0] === 'plan-card');
}
