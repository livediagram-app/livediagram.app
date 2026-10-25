'use client';

// The open popovers, in the order they opened (AnchoredPopover, ConfirmPopover): only the one on top takes a key
// (Escape closes it alone, never the popover it opened from), and a press inside a popover opened from another is
// not a press outside that other. One window listener, taken before anything else (capture), serves them all while
// any is open.
import { useEffect, useRef, type RefObject } from 'react';

type Layer = {
  panel: RefObject<HTMLElement | null>;
  onKey: (e: KeyboardEvent) => void;
};

const layers: Layer[] = [];

function onKeyDown(e: KeyboardEvent): void {
  layers.at(-1)?.onKey(e);
}

function push(layer: Layer): () => void {
  if (layers.length === 0) window.addEventListener('keydown', onKeyDown, true);
  layers.push(layer);
  return () => {
    const at = layers.indexOf(layer);
    if (at >= 0) layers.splice(at, 1);
    if (layers.length === 0) window.removeEventListener('keydown', onKeyDown, true);
  };
}

// The popovers open now, for tests.
export function openPopoverCount(): number {
  return layers.length;
}

/** Joins the stack while mounted: `onKey` hears every key while this popover is the top one. Gives back whether a
 *  node sits in a popover opened above this one (a press there is not outside this one). */
export function usePopoverLayer(
  panel: RefObject<HTMLElement | null>,
  onKey: (e: KeyboardEvent) => void,
): { withinAbove: (target: EventTarget | null) => boolean } {
  const keyRef = useRef(onKey);
  useEffect(() => {
    keyRef.current = onKey;
  });
  const layerRef = useRef<Layer | null>(null);
  useEffect(() => {
    const layer: Layer = { panel, onKey: (e) => keyRef.current(e) };
    layerRef.current = layer;
    return push(layer);
  }, [panel]);
  return {
    withinAbove: (target) => {
      if (!(target instanceof Node)) return false;
      const at = layerRef.current ? layers.indexOf(layerRef.current) : -1;
      if (at < 0) return false;
      return layers.slice(at + 1).some((l) => l.panel.current?.contains(target) ?? false);
    },
  };
}
