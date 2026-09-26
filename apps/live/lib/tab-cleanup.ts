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

import { autoLayoutElements, isBoxed, unionRects, type Element } from '@livediagram/diagram';
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
export function cleanupElements(elements: Element[], kind: CleanupKind): Element[] {
  if (elements.length === 0) return elements;
  if (kind === 'align') return autoAlignElements(elements);
  const block = unionRects(elements.filter(isBoxed));
  if (!block) return elements;
  const { x: originX, y: originY } = block;
  const { options } = AUTO_LAYOUT_CHOICES[kind];
  return autoAlignElements(autoLayoutElements(elements, { ...options, originX, originY }));
}
