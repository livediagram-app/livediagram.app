import type { StyledPrim } from '@livediagram/icons';

// Catalogue / vendored-Lucide primitives as SVG children. Paint (stroke, fill, weight) rides on
// the parent <svg> or <g>, exactly like the markup builders in @livediagram/icons; a StyledPrim's
// own paint (a filled dot, a heavier stroke: the selection-mode glyphs) goes on the element.
export function Prims({ prims }: { prims: readonly StyledPrim[] }) {
  return prims.map((p, i) => {
    const paint = {
      ...(p.fill ? { fill: 'currentColor', stroke: 'none' } : {}),
      ...(p.sw !== undefined ? { strokeWidth: p.sw } : {}),
      ...(p.opacity !== undefined ? { opacity: p.opacity } : {}),
    };
    switch (p.t) {
      case 'path':
        return <path key={i} d={p.d} {...paint} />;
      case 'circle':
        return <circle key={i} cx={p.cx} cy={p.cy} r={p.r} {...paint} />;
      case 'line':
        return <line key={i} x1={p.x1} y1={p.y1} x2={p.x2} y2={p.y2} {...paint} />;
      case 'rect':
        return <rect key={i} x={p.x} y={p.y} width={p.w} height={p.h} rx={p.rx} {...paint} />;
      case 'polyline':
        return <polyline key={i} points={p.points} {...paint} />;
      case 'polygon':
        return <polygon key={i} points={p.points} {...paint} />;
      case 'ellipse':
        return <ellipse key={i} cx={p.cx} cy={p.cy} rx={p.rx} ry={p.ry} {...paint} />;
      case 'text':
        return null;
    }
  });
}
