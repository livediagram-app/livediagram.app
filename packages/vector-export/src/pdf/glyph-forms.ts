// Letters drawn once (liveworkspace/docs/specs/013-export/vector-pdf.md "Text"): each glyph of each face at each size
// is a Form XObject in font units, written the first time it is used and placed by a matrix everywhere after. A
// form draws with the colour and opacity set where it is placed, so one glyph serves every colour.
import type { PlacedGlyph } from '../outline-text/glyph-paths';
import { matrixOps, num } from './matrix';
import type { SvgContext } from './svg-context';

type Command = PlacedGlyph['commands'][number];

/** A glyph outline (font units, y up) as PDF path operators, a quadratic raised to a cubic. */
export function glyphOps(commands: readonly Command[]): {
  ops: string;
  bbox: [number, number, number, number];
} {
  const out: string[] = [];
  let cx = 0;
  let cy = 0;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const see = (x: number, y: number) => {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  };
  for (const { command, args } of commands) {
    for (let i = 0; i + 1 < args.length; i += 2) see(args[i]!, args[i + 1]!);
    if (command === 'moveTo') out.push(`${num(args[0]!)} ${num(args[1]!)} m`);
    else if (command === 'lineTo') out.push(`${num(args[0]!)} ${num(args[1]!)} l`);
    else if (command === 'bezierCurveTo') out.push(`${args.map(num).join(' ')} c`);
    else if (command === 'quadraticCurveTo') {
      const [qx, qy, x, y] = args as [number, number, number, number];
      const c1x = cx + (2 / 3) * (qx - cx);
      const c1y = cy + (2 / 3) * (qy - cy);
      const c2x = x + (2 / 3) * (qx - x);
      const c2y = y + (2 / 3) * (qy - y);
      out.push(`${[c1x, c1y, c2x, c2y, x, y].map(num).join(' ')} c`);
    } else if (command === 'closePath') out.push('h');
    if (args.length >= 2) {
      cx = args[args.length - 2]!;
      cy = args[args.length - 1]!;
    }
  }
  if (minX > maxX) return { ops: out.join('\n'), bbox: [0, 0, 0, 0] };
  return { ops: out.join('\n'), bbox: [minX, minY, maxX, maxY] };
}

/** The operators placing `placed` (glyphs of the face keyed `face`) in the current user space, each a form filled with
 *  the colour already set; forms are written on first use. */
export function placeGlyphs(ctx: SvgContext, face: string, placed: readonly PlacedGlyph[]): string {
  const out: string[] = [];
  for (const g of placed) {
    const key = `${face}#${g.id}`;
    let name = ctx.glyphs.get(key);
    if (!name) {
      const { ops, bbox } = glyphOps(g.commands);
      const obj = ctx.file.putStream(
        ctx.file.alloc(),
        `/Type /XObject /Subtype /Form /BBox [${bbox.map(num).join(' ')}] /Resources ${ctx.res.ref} 0 R`,
        `${ops}\nf`,
      );
      name = ctx.res.name('XObject', obj);
      ctx.glyphs.set(key, name);
    }
    out.push(`q ${matrixOps(g.matrix)} /${name} Do Q`);
  }
  return out.join('\n');
}
