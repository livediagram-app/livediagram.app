import { useCallback } from 'react';
import {
  isPointerNote,
  snapPointerTip,
  withPointerTip,
  type Element,
} from '@livedocuments/document';
import { track } from '@/lib/telemetry';
import { useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';

// The pointer note's tip handle (docs/specs/009-elements/blueprints/pointer-note.md "Tip handle"): let go at `tipAbs`
// (canvas coordinates), the tip snaps to the nearest host point in reach and attaches there, or stays free where it
// was let go. One history step. Whether it attaches is read from the elements as they are, for its telemetry, not from
// inside the commit's updater, which React may run later.
export function usePointerNoteSetters(
  commitElements: (map: (els: Element[]) => Element[]) => void,
  elements: readonly Element[],
) {
  // Read through a ref so the setter keeps one identity across renders (every element view receives it).
  const latest = useLatest(elements);
  const setPointerTip = useCallback(
    (elementId: string, tipAbs: { x: number; y: number }) => {
      const tipped = (els: readonly Element[], el: Element): Element => {
        if (!isPointerNote(el)) return el;
        const snap = snapPointerTip(els, el, tipAbs);
        const { attachedTo: _host, attachAt: _at, ...free } = withPointerTip(el, snap.pointerTip);
        if (!snap.attachedTo) return free;
        return { ...free, attachedTo: snap.attachedTo, attachAt: snap.attachAt };
      };
      const now = latest.current;
      const note = now.find((el) => el.id === elementId);
      if (!note || !isPointerNote(note)) return;
      const attached = !!(tipped(now, note) as { attachedTo?: string }).attachedTo;
      commitElements((els) => els.map((el) => (el.id === elementId ? tipped(els, el) : el)));
      track('Element', 'Changed', attached ? 'PointerAttach' : 'PointerTip');
    },
    [commitElements, latest],
  );
  return { setPointerTip };
}
