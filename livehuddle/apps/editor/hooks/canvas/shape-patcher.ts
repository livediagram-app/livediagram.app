import type { Element, ShapeElement, ShapeKind } from '@livehuddle/document';
import { track } from '@/lib/telemetry';

// "Patch this field on every SELECTED shape of one kind, and say so."
//
// Several setters had this body written out. They differed in one expression (which shape kind they apply to)
// and nothing else, down to the telemetry call.
//
// Two properties are load-bearing and easy to lose when this is retyped. The
// empty-selection early return means no commit and no telemetry, so an
// interaction that touched nothing leaves no trace. And the kind gate is
// applied per element, not to the selection as a whole, so a multi-selection
// holding two kinds takes each change only on the elements it means something
// for.
//
// Lives here rather than in packages/ because only the editor has a selection
// to patch; `commit` and `currentSelectionIds` are its own.
export function makeShapePatcher({
  currentSelectionIds,
  commit,
  matches,
}: {
  currentSelectionIds: () => ReadonlySet<string>;
  commit: (fn: (els: Element[]) => Element[]) => void;
  /** Which shape kinds this setter applies to. */
  matches: (kind: ShapeKind) => boolean;
}) {
  return (patch: Partial<ShapeElement>, telemetryType: string) => {
    const ids = currentSelectionIds();
    if (ids.size === 0) return;
    commit((els) =>
      els.map((el) =>
        ids.has(el.id) && el.type === 'shape' && matches(el.shape) ? { ...el, ...patch } : el,
      ),
    );
    track('Element', 'Changed', telemetryType);
  };
}
