// The tab's cleanup transform (docs/specs/008-canvas/layout-cleanup.md), as a pure function over an element
// list: Auto-align. Auto Layout's styles are gone from livehuddle (Work Tracker #423, part 4); the layout engine
// itself stays in @livehuddle/document (Work Tracker #459).
//
// One module because there are two callers with one requirement between
// them: the menu row COMMITS a cleanup, and hovering that row PREVIEWS it. A
// preview that is not byte-for-byte the change its click makes is worse than no
// preview, which is the same reason lib/style-presets.ts exists for the preset
// tiles. Keeping the arithmetic here (rather than inside the command that
// commits it) is also what lets the command compute from the elements it is
// handed rather than from a render closure, so a commit taken while a preview
// is on screen still starts from the real pre-hover state.

import type { Element } from '@livehuddle/document';
import { autoAlignElements } from '@/lib/auto-align';

/**
 * Run a cleanup over a tab's elements. Pure: same input, same output, no
 * commit, no telemetry. Auto-align only grid-snaps what is already there.
 */
export function cleanupElements(elements: Element[]): Element[] {
  if (elements.length === 0) return elements;
  return autoAlignElements(elements);
}
