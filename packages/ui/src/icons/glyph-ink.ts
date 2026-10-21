import type { IconPrim } from '@livediagram/icons';
import { Children, Fragment, isValidElement, type ReactNode } from 'react';

import { Prims } from './Prims';

const num = (v: unknown) => Number(v ?? 0);

type Props = Record<string, unknown> & { children?: ReactNode; transform?: unknown };

// The drawn primitives of a Glyph's children, read from their JSX props (no DOM), or null when a child can't be
// read: a transform, or a component other than Prims whose drawing is not visible from here.
export function childPrims(children: ReactNode): IconPrim[] | null {
  const out: IconPrim[] = [];
  let unknown = false;
  const visit = (node: ReactNode) => {
    Children.forEach(node, (c) => {
      if (unknown || !isValidElement(c)) return;
      const p = c.props as Props;
      if (p.transform !== undefined) {
        unknown = true;
        return;
      }
      if (c.type === Fragment) return visit(p.children);
      if (c.type === Prims) {
        out.push(...(p.prims as readonly IconPrim[]));
        return;
      }
      switch (c.type) {
        case 'g':
          return visit(p.children);
        case 'path':
          if (typeof p.d === 'string') out.push({ t: 'path', d: p.d });
          return;
        case 'circle':
          out.push({ t: 'circle', cx: num(p.cx), cy: num(p.cy), r: num(p.r) });
          return;
        case 'ellipse':
          out.push({ t: 'ellipse', cx: num(p.cx), cy: num(p.cy), rx: num(p.rx), ry: num(p.ry) });
          return;
        case 'rect':
          out.push({ t: 'rect', x: num(p.x), y: num(p.y), w: num(p.width), h: num(p.height) });
          return;
        case 'line':
          out.push({ t: 'line', x1: num(p.x1), y1: num(p.y1), x2: num(p.x2), y2: num(p.y2) });
          return;
        case 'polyline':
        case 'polygon':
          if (typeof p.points === 'string') out.push({ t: c.type, points: p.points });
          return;
        case 'title':
        case 'desc':
        case 'defs':
          return;
        default:
          unknown = true;
      }
    });
  };
  visit(children);
  return unknown ? null : out;
}
