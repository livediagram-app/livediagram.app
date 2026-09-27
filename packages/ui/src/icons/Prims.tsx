import type { IconPrim } from '@livediagram/icons';

// Catalogue / vendored-Lucide primitives as SVG children. Paint (stroke, fill, weight) rides on
// the parent <svg> or <g>, exactly like the markup builders in @livediagram/icons.
export function Prims({ prims }: { prims: readonly IconPrim[] }) {
  return prims.map((p, i) => {
    switch (p.t) {
      case 'path':
        return <path key={i} d={p.d} />;
      case 'circle':
        return <circle key={i} cx={p.cx} cy={p.cy} r={p.r} />;
      case 'line':
        return <line key={i} x1={p.x1} y1={p.y1} x2={p.x2} y2={p.y2} />;
      case 'rect':
        return <rect key={i} x={p.x} y={p.y} width={p.w} height={p.h} rx={p.rx} />;
      case 'polyline':
        return <polyline key={i} points={p.points} />;
      case 'polygon':
        return <polygon key={i} points={p.points} />;
      case 'ellipse':
        return <ellipse key={i} cx={p.cx} cy={p.cy} rx={p.rx} ry={p.ry} />;
      case 'text':
        return null;
    }
  });
}
