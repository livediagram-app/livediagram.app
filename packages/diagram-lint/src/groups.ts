// Frames and their members, by the views' containment (blueprint "The checks", LN12, LN13, N13): the group
// codes judge frames, never lanes; a box belongs to the first frame on its chain of containers, and a
// frame's members are every box whose chain reaches it.

import { isBoxed, type BoxedElement, type ElementId } from '@livediagram/document';
import type { LintContext } from './context';

// The frame an id names, or null for a lane, a mind node or anything else.
function frameAt(ctx: LintContext, id: ElementId): BoxedElement | null {
  const el = ctx.byId.get(id);
  return el && isBoxed(el) && el.type === 'shape' && el.shape === 'frame' ? el : null;
}

// The containers holding an element, innermost first.
function chainOf(ctx: LintContext, id: ElementId): ElementId[] {
  const chain: ElementId[] = [];
  for (let at = ctx.containers.get(id) ?? null; at !== null; at = ctx.containers.get(at) ?? null)
    chain.push(at);
  return chain;
}

export function frameOf(ctx: LintContext, box: BoxedElement): BoxedElement | null {
  for (const id of chainOf(ctx, box.id)) {
    const frame = frameAt(ctx, id);
    if (frame) return frame;
  }
  return null;
}

// Every frame with at least one member, with its members, in paint order.
export function framesWithMembers(
  ctx: LintContext,
): { frame: BoxedElement; members: Set<ElementId> }[] {
  const members = new Map<BoxedElement, Set<ElementId>>();
  for (const box of ctx.boxes)
    for (const id of chainOf(ctx, box.id)) {
      const frame = frameAt(ctx, id);
      if (frame) members.set(frame, (members.get(frame) ?? new Set()).add(box.id));
    }
  return [...members]
    .map(([frame, set]) => ({ frame, members: set }))
    .sort((a, b) => ctx.order.get(a.frame.id)! - ctx.order.get(b.frame.id)!);
}
