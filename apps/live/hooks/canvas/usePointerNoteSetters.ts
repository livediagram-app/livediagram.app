import { useCallback } from 'react';
import { isPointerNote, snapPointerTip, withPointerTip, type Element } from '@livediagram/document';
import { track } from '@/lib/telemetry';

// The pointer note's tip handle (docs/specs/009-elements/blueprints/pointer-note.md "Tip handle"): let go at `tipAbs`
// (canvas coordinates), the tip snaps to the nearest host point in reach and attaches there, or stays free where it
// was let go. One history step.
export function usePointerNoteSetters(
  commitElements: (map: (els: Element[]) => Element[]) => void,
) {
  const setPointerTip = useCallback(
    (elementId: string, tipAbs: { x: number; y: number }) => {
      let attached = false;
      commitElements((els) =>
        els.map((el) => {
          if (el.id !== elementId || !isPointerNote(el)) return el;
          const snap = snapPointerTip(els, el, tipAbs);
          const { attachedTo: _host, attachAt: _at, ...free } = withPointerTip(el, snap.pointerTip);
          if (!snap.attachedTo) return free as Element;
          attached = true;
          return { ...free, attachedTo: snap.attachedTo, attachAt: snap.attachAt } as Element;
        }),
      );
      track('Element', 'Changed', attached ? 'PointerAttach' : 'PointerTip');
    },
    [commitElements],
  );
  return { setPointerTip };
}
