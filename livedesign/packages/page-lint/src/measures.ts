// The summary line's extent (blueprint "Behaviour and state" step 2): the drawing's rounded size.

import { contentBounds } from '@livedesign/document';
import { finiteRect } from './boxes';
import type { LintContext } from './context';

// The drawing's rounded extent, arrow routes included; null when nothing is visible.
export function lintExtent(ctx: LintContext): { width: number; height: number } | null {
  const drawn = ctx.visible.filter((el) => el.type === 'arrow' || finiteRect(el));
  if (drawn.length === 0) return null;
  const b = contentBounds(drawn);
  return { width: Math.round(b.w), height: Math.round(b.h) };
}
