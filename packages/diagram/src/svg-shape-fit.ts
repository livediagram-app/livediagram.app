// A shape-table part (shape-geometry.ts, drawn in its own viewBox) mapped into
// an element's box, for the SVG export.
//
// The export used to nest each silhouette in an <svg> whose viewBox stretched
// the table's 0..100 art over the box, keeping the border thin with
// `vector-effect="non-scaling-stroke"`. Browsers honour that; resvg, which
// rasterises the MCP's inline previews (docs/specs/015-api/mcp-server.md §5), does not, so a frame
// or cylinder came out with a border scaled up with the box: several pixels
// thick on a large frame. Mapping the coordinates themselves draws the same
// outline with nothing scaled, so the stroke is the stroke in every renderer.
//
// The table only uses absolute M / L / C / A / Z path commands, rects,
// polygons, ellipses and circles, and never rotates an arc, which is all this
// has to handle.

import type { ShapeGeometry, ShapePart } from './shape-geometry';

export type BoxFit = { sx: number; sy: number; ox: number; oy: number };

// How a geometry's viewBox lands on a box: stretched (`none`) or scaled
// uniformly and centred (`xMidYMid meet`), as the nested <svg> did.
export function boxFit(
  geometry: Pick<ShapeGeometry, 'viewBox' | 'preserveAspectRatio'>,
  box: { x: number; y: number; width: number; height: number },
): BoxFit {
  const [vx, vy, vw, vh] = geometry.viewBox.split(/[\s,]+/).map(Number) as [
    number,
    number,
    number,
    number,
  ];
  let sx = box.width / vw;
  let sy = box.height / vh;
  let dx = 0;
  let dy = 0;
  if (geometry.preserveAspectRatio !== 'none') {
    const s = Math.min(sx, sy);
    dx = (box.width - vw * s) / 2;
    dy = (box.height - vh * s) / 2;
    sx = s;
    sy = s;
  }
  return { sx, sy, ox: box.x + dx - vx * sx, oy: box.y + dy - vy * sy };
}

const PARAMS: Record<string, number> = { M: 2, L: 2, C: 6, A: 7, Z: 0 };

function fitPath(d: string, f: BoxFit): string {
  const tokens = d.match(/[MLCAZ]|-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?/gi) ?? [];
  const out: string[] = [];
  let cmd = '';
  let args: number[] = [];
  const x = (v: number) => round(f.ox + v * f.sx);
  const y = (v: number) => round(f.oy + v * f.sy);
  const flush = () => {
    if (cmd === 'A') {
      const [rx, ry, rot, large, sweep, ex, ey] = args as [
        number,
        number,
        number,
        number,
        number,
        number,
        number,
      ];
      out.push(
        `A ${round(rx * f.sx)} ${round(ry * f.sy)} ${rot} ${large} ${sweep} ${x(ex)} ${y(ey)}`,
      );
    } else {
      const pts: string[] = [];
      for (let i = 0; i < args.length; i += 2) pts.push(`${x(args[i]!)} ${y(args[i + 1]!)}`);
      out.push(`${cmd} ${pts.join(', ')}`);
    }
    args = [];
  };
  for (const t of tokens) {
    const upper = t.toUpperCase();
    if (upper in PARAMS && /[a-z]/i.test(t)) {
      cmd = upper;
      if (cmd === 'Z') out.push('Z');
      continue;
    }
    args.push(Number(t));
    if (args.length === PARAMS[cmd]) flush();
  }
  return out.join(' ');
}

const round = (v: number) => Math.round(v * 100) / 100;

export function fitShapePart(part: ShapePart, f: BoxFit): ShapePart {
  switch (part.tag) {
    case 'path':
      return { ...part, d: fitPath(part.d, f) };
    case 'polygon':
      return {
        ...part,
        points: part.points
          .trim()
          .split(/\s+/)
          .map((pt) => {
            const [px, py] = pt.split(',').map(Number) as [number, number];
            return `${round(f.ox + px * f.sx)},${round(f.oy + py * f.sy)}`;
          })
          .join(' '),
      };
    case 'rect':
      return {
        ...part,
        x: f.ox + part.x * f.sx,
        y: f.oy + part.y * f.sy,
        width: part.width * f.sx,
        height: part.height * f.sy,
        ...(part.rx !== undefined ? { rx: part.rx * f.sx, ry: part.rx * f.sy } : {}),
      };
    case 'ellipse':
      return {
        ...part,
        cx: f.ox + part.cx * f.sx,
        cy: f.oy + part.cy * f.sy,
        rx: part.rx * f.sx,
        ry: part.ry * f.sy,
      };
    case 'circle':
      return f.sx === f.sy
        ? { ...part, cx: f.ox + part.cx * f.sx, cy: f.oy + part.cy * f.sy, r: part.r * f.sx }
        : {
            tag: 'ellipse',
            role: part.role,
            cx: f.ox + part.cx * f.sx,
            cy: f.oy + part.cy * f.sy,
            rx: part.r * f.sx,
            ry: part.r * f.sy,
          };
  }
}
