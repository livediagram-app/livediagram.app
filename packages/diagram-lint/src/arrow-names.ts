// How findings name arrows (blueprint "Presentation and UX", N18): by their ends in messages
// (`orders→bus`), and as a selector an edit operation can take in fixes (`orders->bus` when exactly one
// arrow joins them that way, else the arrow's own ref).

import type { ArrowElement, Element, ElementId } from '@livediagram/document';
import { refOf, type LintContext } from './context';

// The ids an arrow's ends are pinned to, when both are pinned to an element.
export function pinnedEnds(arrow: Element): [ElementId, ElementId] | null {
  if (arrow.type !== 'arrow' || arrow.from.kind !== 'pinned' || arrow.to.kind !== 'pinned')
    return null;
  return [arrow.from.elementId, arrow.to.elementId];
}

function endRefs(ctx: LintContext, arrow: ArrowElement): [string, string] | null {
  const ends = pinnedEnds(arrow);
  return ends && [refOf(ctx, ends[0]), refOf(ctx, ends[1])];
}

export function arrowName(ctx: LintContext, arrow: ArrowElement): string {
  const ends = endRefs(ctx, arrow);
  return ends ? `${ends[0]}→${ends[1]}` : refOf(ctx, arrow.id);
}

export function arrowSelector(ctx: LintContext, arrow: ArrowElement): string {
  const mine = pinnedEnds(arrow);
  if (!mine) return refOf(ctx, arrow.id);
  const same = ctx.visible.filter((el) => {
    const theirs = pinnedEnds(el);
    return theirs !== null && theirs[0] === mine[0] && theirs[1] === mine[1];
  });
  return same.length === 1
    ? `${refOf(ctx, mine[0])}->${refOf(ctx, mine[1])}`
    : refOf(ctx, arrow.id);
}
