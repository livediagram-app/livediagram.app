// The tab's cleanup transforms (docs/specs/008-canvas/layout-cleanup.md), as pure functions over an element
// list: Auto-align, and Auto Layout in each of its styles.
//
// One module because there are now two callers with one requirement between
// them: the menu row COMMITS a cleanup, and hovering that row PREVIEWS it. A
// preview that is not byte-for-byte the change its click makes is worse than no
// preview, which is the same reason lib/style-presets.ts exists for the preset
// tiles. Keeping the arithmetic here (rather than inside the command that
// commits it) is also what lets the command compute from the elements it is
// handed rather than from a render closure, so a commit taken while a preview
// is on screen still starts from the real pre-hover state.

import { isBoxed, tidyLayoutElements, type Element, type Layer } from '@livediagram/document';
import { lockedElementIds } from '@/lib/locked-element-ids';
import { autoAlignElements } from '@/lib/auto-align';
import { AUTO_LAYOUT_CHOICES, type AutoLayoutChoice } from '@/lib/auto-layout-choices';

/** Auto-align, or Auto Layout in one of its styles. */
export type CleanupKind = 'align' | AutoLayoutChoice;

/**
 * Run a cleanup over a tab's elements. Pure: same input, same output, no
 * commit, no telemetry.
 *
 * Auto-align only grid-snaps what is already there. Auto Layout recomputes
 * positions from the arrow graph, then pins the laid-out block to the
 * diagram's current top-left so it stays where the author is looking instead of
 * jumping to the origin, and grid-snaps the result (the same final pass the
 * AI-apply path uses). The origin is read from the elements passed in rather
 * than from the tab in state, which is what makes it safe to run against a
 * snapshot.
 */
export function cleanupElements(
  elements: Element[],
  kind: CleanupKind,
  layers?: Layer[],
): Element[] {
  if (elements.length === 0) return elements;
  // Locked elements, and everything on a locked layer, stay exactly where they are
  // (docs/specs/008-canvas/layout-cleanup.md "Locked elements stay put").
  const lockedIds = lockedElementIds(elements, layers);
  if (kind === 'align') return autoAlignElements(elements, lockedIds);
  const { options } = AUTO_LAYOUT_CHOICES[kind];
  // The tidy profile keeps the author's sizes, lands the block where the nodes were and on the
  // grid by their centres, so nothing else on the tab is touched. A layout reads the drawing it is
  // given, so laying out its own result can refine it a little further; it runs until a pass moves
  // nothing (bounded), so one press lands on the settled layout and a second finds it already tidy.
  const layout = (els: Element[]) => tidyLayoutElements(els, { ...options, lockedIds });
  let out = layout(elements);
  // A big tab gets one pass: each costs tens of ms there, and a hover preview must stay quick.
  const passes = elements.length <= SETTLE_ELEMENT_LIMIT ? MAX_LAYOUT_PASSES : 1;
  for (let pass = 1; pass < passes; pass++) {
    const next = layout(out);
    if (sameBoxes(out, next)) break;
    out = next;
  }
  return out;
}

// Passes a layout gets to settle. Most settle on the first; a few hand-drawn trees take one more.
const MAX_LAYOUT_PASSES = 3;
// Up to this many elements (shapes and arrows) a layout settles; beyond it one pass is the press.
// A 300-shape tab's pass is ~20 ms here and several times that on CI, so three would break the hover budget.
const SETTLE_ELEMENT_LIMIT = 300;

// Whether every box sits exactly where it did: the arrows follow the boxes, so this is the layout.
function sameBoxes(a: Element[], b: Element[]): boolean {
  return a.every((el, i) => {
    const o = b[i];
    if (!o || !isBoxed(el) || !isBoxed(o)) return true;
    return el.x === o.x && el.y === o.y;
  });
}

export { lockedElementIds };
