import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { TEMPLATES } from '@livediagram/templates';
import { TemplatePreview } from './template-preview';

// Every preview illustration must stay inside its declared viewBox: the
// picker tile clips at the SVG edge, so geometry past it renders as a
// cut-off drawing (the Tree mind map's bottom branch shipped clipped this
// way). This scans each preview's static markup and rebuilds a rough
// bounding box from the drawn primitives: rects / circles / ellipses /
// lines / polygons / polylines are measured exactly, and path data is
// walked command-aware (the previews use absolute M/L/Q/C/V/H/A commands).
// Curve control points may overshoot the painted curve slightly, so the
// check allows a small tolerance beyond the half-stroke margin.

const num = (v: string | undefined): number => (v === undefined ? NaN : Number(v));

type Bounds = { minX: number; minY: number; maxX: number; maxY: number };

function markupBounds(svg: string): Bounds {
  const b: Bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  const grow = (x: number, y: number) => {
    if (Number.isNaN(x) || Number.isNaN(y)) return;
    b.minX = Math.min(b.minX, x);
    b.minY = Math.min(b.minY, y);
    b.maxX = Math.max(b.maxX, x);
    b.maxY = Math.max(b.maxY, y);
  };
  const attrs = (s: string): Record<string, string> =>
    Object.fromEntries([...s.matchAll(/([\w-]+)="([^"]*)"/g)].map((m) => [m[1]!, m[2]!]));
  for (const m of svg.matchAll(/<rect ([^>]*)>/g)) {
    const a = attrs(m[1]!);
    grow(num(a.x), num(a.y));
    grow(num(a.x) + num(a.width), num(a.y) + num(a.height));
  }
  for (const m of svg.matchAll(/<(?:circle|ellipse) ([^>]*)>/g)) {
    const a = attrs(m[1]!);
    const rx = num(a.rx ?? a.r);
    const ry = num(a.ry ?? a.r);
    grow(num(a.cx) - rx, num(a.cy) - ry);
    grow(num(a.cx) + rx, num(a.cy) + ry);
  }
  for (const m of svg.matchAll(/<line ([^>]*)>/g)) {
    const a = attrs(m[1]!);
    grow(num(a.x1), num(a.y1));
    grow(num(a.x2), num(a.y2));
  }
  for (const m of svg.matchAll(/<(?:polygon|polyline)[^>]*points="([^"]*)"/g)) {
    for (const p of m[1]!.trim().split(/\s+/)) {
      const [x, y] = p.split(',').map(Number);
      grow(x!, y!);
    }
  }
  for (const m of svg.matchAll(/<path[^>]*d="([^"]*)"/g)) {
    let px = 0;
    let py = 0;
    for (const seg of m[1]!.matchAll(/([MLQCVHAZ])([^MLQCVHAZ]*)/gi)) {
      const cmd = seg[1]!.toUpperCase();
      const nums = [...seg[2]!.matchAll(/-?\d+(?:\.\d+)?/g)].map((x) => Number(x[0]));
      if (cmd === 'V') for (const n of nums) grow(px, (py = n));
      else if (cmd === 'H') for (const n of nums) grow((px = n), py);
      else if (cmd === 'A') {
        // Only the endpoint bounds an arc here (rx ry rot laf swf x y).
        for (let i = 0; i + 6 < nums.length; i += 7) grow((px = nums[i + 5]!), (py = nums[i + 6]!));
      } else if (cmd !== 'Z') {
        for (let i = 0; i + 1 < nums.length; i += 2) grow((px = nums[i]!), (py = nums[i + 1]!));
      }
    }
  }
  return b;
}

describe('TemplatePreview bounds', () => {
  it('keeps every illustration inside its viewBox (nothing clips in the tile)', () => {
    // Half a typical 1.5 stroke, plus a little slack for Bezier control
    // points that pull wider than the painted curve.
    const tolerance = 1.25;
    const spills: string[] = [];
    // Hidden templates (spec/69) ship no preview; only listed ones render.
    for (const t of TEMPLATES.filter((x) => !x.hidden)) {
      const el = TemplatePreview({ kind: t.kind });
      expect(el, `missing preview for '${t.kind}'`).not.toBeNull();
      const svg = renderToStaticMarkup(el!);
      const vbMatch = svg.match(/viewBox="([\d.\- ]+)"/);
      expect(vbMatch, `preview for '${t.kind}' has no viewBox`).not.toBeNull();
      const [vx, vy, vw, vh] = vbMatch![1]!.split(' ').map(Number) as [
        number,
        number,
        number,
        number,
      ];
      const b = markupBounds(svg);
      const out: string[] = [];
      if (b.minX < vx - tolerance) out.push(`left by ${(vx - b.minX).toFixed(1)}`);
      if (b.minY < vy - tolerance) out.push(`top by ${(vy - b.minY).toFixed(1)}`);
      if (b.maxX > vx + vw + tolerance) out.push(`right by ${(b.maxX - vx - vw).toFixed(1)}`);
      if (b.maxY > vy + vh + tolerance) out.push(`bottom by ${(b.maxY - vy - vh).toFixed(1)}`);
      if (out.length) spills.push(`${t.kind}: ${out.join(', ')}`);
    }
    expect(spills).toEqual([]);
  });
});
