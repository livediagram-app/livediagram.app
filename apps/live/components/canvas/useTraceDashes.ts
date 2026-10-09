import { useLayoutEffect, type RefObject } from 'react';

// Trace on an SVG-rendered shape (docs/specs/028-animation/element-animations.md "Shape"): a light
// with a tail runs the outline. The outline is drawn with `vector-effect: non-scaling-stroke`, so
// its dashes are measured in the rendered box, where `pathLength` no longer maps onto the outline
// (the pattern repeats and two lights show). Each copy's on-screen length is measured instead,
// once and again when the box resizes, and written straight onto the paths: the head and tail as
// px dashes, the length as `--lvd-perim` for the keyframes. No React state, so nothing re-renders.

// The share of the outline the tail covers, and the head inside its leading end.
const TAIL = 0.28;
const HEAD = 0.12;
const SAMPLES = 96;

function screenLength(path: SVGGeometryElement, sx: number, sy: number): number {
  const total = path.getTotalLength();
  let length = 0;
  let prev = path.getPointAtLength(0);
  for (let i = 1; i <= SAMPLES; i++) {
    const p = path.getPointAtLength((total * i) / SAMPLES);
    length += Math.hypot((p.x - prev.x) * sx, (p.y - prev.y) * sy);
    prev = p;
  }
  return length;
}

export function useTraceDashes(
  group: RefObject<SVGGElement | null>,
  active: boolean,
  // What the outline is: measured again when it changes (a new shape kind or corner, at the same
  // size, mounts new copies a resize would never report).
  geometry: unknown,
): void {
  useLayoutEffect(() => {
    const g = group.current;
    const svg = g?.ownerSVGElement;
    if (!active || !g || !svg) return;
    const measure = () => {
      const vb = svg.viewBox.baseVal;
      if (!vb || !vb.width || !vb.height || !svg.clientWidth) return;
      let sx = svg.clientWidth / vb.width;
      let sy = svg.clientHeight / vb.height;
      if (svg.getAttribute('preserveAspectRatio') !== 'none') sx = sy = Math.min(sx, sy);
      for (const path of g.querySelectorAll<SVGGeometryElement>('[class^="lvd-svg-trace-"]')) {
        const s = screenLength(path, sx, sy);
        const head = path.classList.contains('lvd-svg-trace-head');
        path.style.strokeDasharray = head
          ? `0 ${(TAIL - HEAD) * s} ${HEAD * s} ${(1 - TAIL) * s}`
          : `${TAIL * s} ${(1 - TAIL) * s}`;
        path.style.setProperty('--lvd-perim', String(s));
      }
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(svg);
    return () => observer.disconnect();
  }, [group, active, geometry]);
}
