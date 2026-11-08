// The summary line's numbers (blueprint "Behaviour and state" step 2): the drawing's extent. No arrow is drawn as
// one since part 4 of the element engine (docs/specs/002-project-scope/not-in-livehuddle.md), so nothing crosses.

import { contentBounds, isBoxed } from '@livehuddle/document';
import type { LintContext } from './context';

// The drawing's rounded extent, a stored arrow's line and card included; null when nothing is visible.
export function lintExtent(ctx: LintContext): { width: number; height: number } | null {
  const drawn = ctx.visible.filter(
    (el) => !isBoxed(el) || [el.x, el.y, el.width, el.height].every((v) => Number.isFinite(v)),
  );
  if (drawn.length === 0) return null;
  const b = contentBounds(drawn);
  return { width: Math.round(b.w), height: Math.round(b.h) };
}
