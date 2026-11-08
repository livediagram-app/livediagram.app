// Pure geometry + frame-equality helpers for the canvas drag machine
// (useEditorDrag). Split out of the hook so the per-pointer-move math
// can be reasoned about (and unit-tested) on its own, away from the
// stateful React closure: alignment / distribution / snap-target list
// equality (used to bail the rAF setters out of redundant re-renders).
// All stateless; nothing here touches React.

import type { AlignmentGuide, DistributionGuide } from '@livehuddle/document';
import type { SnapTarget } from '@/components/canvas/Canvas.types';

// Value-equality for two guide lists. Used to bail out of the
// snapGuides state update when the guides haven't changed: on the vast
// majority of drag frames `alignmentGuides` returns an empty list (no
// snap), and feeding a fresh `[]` to setState every pointermove would
// force a redundant re-render of the whole editor tree on top of the
// per-frame `tick`. Returning the previous reference from the setState
// updater lets React skip the render entirely (Object.is bail-out).
export function sameGuides(a: AlignmentGuide[], b: AlignmentGuide[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i]!;
    const y = b[i]!;
    if (x.axis !== y.axis || x.position !== y.position || x.start !== y.start || x.end !== y.end) {
      return false;
    }
  }
  return true;
}

// Value-equality for two distribution-guide lists (axis / gap / spans),
// so the rAF setter can bail when they haven't changed.
export function sameDistGuides(a: DistributionGuide[], b: DistributionGuide[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i]!;
    const y = b[i]!;
    if (x.axis !== y.axis || x.gap !== y.gap || x.spans.length !== y.spans.length) return false;
    for (let j = 0; j < x.spans.length; j++) {
      const s = x.spans[j]!;
      const t = y.spans[j]!;
      if (s.from !== t.from || s.to !== t.to || s.cross !== t.cross || s.axis !== t.axis) {
        return false;
      }
    }
  }
  return true;
}

// Value-equality for two snap-target lists (position + active flag), so the
// rAF setter bails when the revealed markers haven't changed frame to frame.
export function sameTargets(a: SnapTarget[], b: SnapTarget[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i]!;
    const y = b[i]!;
    if (x.x !== y.x || x.y !== y.y || x.active !== y.active) return false;
  }
  return true;
}
