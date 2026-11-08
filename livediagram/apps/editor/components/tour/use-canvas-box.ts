import { useEffect, useState, type RefObject } from 'react';

/** The canvas's box on screen, kept up as it resizes: where Watch It Built's player and start panel sit. */
export function useCanvasBox(canvasRef: RefObject<HTMLElement | null>): DOMRect | null {
  const [box, setBox] = useState<DOMRect | null>(null);
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const read = () => setBox(el.getBoundingClientRect());
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, [canvasRef]);
  return box;
}

/** The player's place: centred on the canvas, low over it. */
export function playerPlace(box: DOMRect | null) {
  return {
    left: box ? box.left + box.width / 2 : window.innerWidth / 2,
    bottom: box ? window.innerHeight - box.bottom + 76 : 96,
  };
}
