import type { ReactElement } from 'react';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { STORY_CLASSES } from './motion';

// The template previews' checks, written once and run by every product over its own catalogue and previews
// (its template-preview.test.ts). Each guards something nothing at runtime notices: a template with no
// picture, a drawing clipped at its tile's edge, a story shape showing at rest, a story class the stylesheet
// doesn't define.

type Template<Kind extends string> = { kind: Kind; hidden?: boolean };

export type TemplatePreviewSuite<Kind extends string> = {
  // The product's catalogue (TEMPLATES in its templates package).
  templates: readonly Template<Kind>[];
  // Its previews, one per kind: pure render, no hooks, so it can be called as a plain function.
  TemplatePreview: (props: { kind: Kind }) => ReactElement | null;
  // Whether some preview has a group that arrives (pv-arrive), which must then scale from its own box.
  expectArrivals?: boolean;
};

const num = (v: string | undefined): number => (v === undefined ? NaN : Number(v));

type Bounds = { minX: number; minY: number; maxX: number; maxY: number };

// A rough bounding box rebuilt from a preview's drawn primitives: rects / circles / ellipses / lines /
// polygons / polylines are measured exactly, and path data is walked command-aware (the previews use
// absolute M/L/Q/C/V/H/A commands).
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

// The shapes a hover story adds that must be hidden until it adds them.
const STORY_ENTRANCES = ['pv-new', 'pv-arrive', 'pv-token', 'pv-travel'];

export function describeTemplatePreviews<Kind extends string>({
  templates,
  TemplatePreview,
  expectArrivals = false,
}: TemplatePreviewSuite<Kind>) {
  // A hidden template never renders in a grid, so it ships no preview and is skipped where noted.
  const listed = templates.filter((t) => !t.hidden);

  // Every catalogue entry must render a preview illustration. The preview groups are hand-authored
  // switches, so a new kind that lands in the catalogue without a matching case falls through every
  // group and the picker shows an empty grey tile.
  describe('TemplatePreview', () => {
    it('returns an SVG for every listed template in the catalogue', () => {
      for (const template of listed) {
        const preview = TemplatePreview({ kind: template.kind });
        expect(preview, `missing preview illustration for '${template.kind}'`).not.toBeNull();
        expect(preview?.type).toBe('svg');
      }
    });
  });

  // Every preview illustration must stay inside its declared viewBox: the picker tile clips at the SVG
  // edge, so geometry past it renders as a cut-off drawing (a mind map's bottom branch once shipped
  // clipped this way). Curve control points may overshoot the painted curve slightly, so the check
  // allows a small tolerance beyond the half-stroke margin.
  describe('TemplatePreview bounds', () => {
    it('keeps every illustration inside its viewBox (nothing clips in the tile)', () => {
      // Half a typical 1.5 stroke, plus a little slack for Bezier control
      // points that pull wider than the painted curve.
      const tolerance = 1.25;
      const spills: string[] = [];
      for (const t of listed) {
        const el = TemplatePreview({ kind: t.kind });
        expect(el, `missing preview for '${t.kind}'`).not.toBeNull();
        const svg = renderToStaticMarkup(el);
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

  // The hover stories (preview-motion.css) draw extra shapes into a preview: the ideas a mind map
  // grows, the card that lands on a kanban, the flowchart's token. Those shapes are in the markup at
  // rest, and the editor's picker renders the same markup without the motion stylesheet, so each one
  // must be invisible until its story adds it.
  const markup = templates.map((t) => ({
    kind: t.kind,
    svg: renderToStaticMarkup(createElement(TemplatePreview, { kind: t.kind })),
  }));

  describe('preview hover stories', () => {
    it('keeps every shape a story adds invisible at rest', () => {
      for (const { kind, svg } of markup) {
        for (const tag of svg.match(/<[a-z]+ [^>]*class="[^"]*"[^>]*>/g) ?? []) {
          const classes = /class="([^"]*)"/.exec(tag)![1]!.split(' ');
          if (!classes.some((c) => STORY_ENTRANCES.includes(c))) continue;
          expect(tag, `${kind}: ${tag}`).toContain('opacity="0"');
        }
      }
    });

    it('uses only story classes the stylesheet defines', () => {
      for (const { kind, svg } of markup) {
        for (const [, list] of svg.matchAll(/class="([^"]*)"/g)) {
          for (const c of list!.split(' ').filter((c) => c.startsWith('pv-'))) {
            expect(STORY_CLASSES, `${kind} uses ${c}`).toContain(c);
          }
        }
      }
    });

    // Every card in the gallery tells its own story, not just the build
    // replay, so a new template without one fails here (Blank, which the
    // gallery doesn't list, is the exception).
    it('tells a story on every template', () => {
      const missing = markup
        .filter(({ kind, svg }) => kind !== 'blank' && !/class="[^"]*\bpv-/.test(svg))
        .map((m) => m.kind);
      expect(missing).toEqual([]);
    });
  });

  // An arriving group scales from its own box: without transform-box: fill-box a <g> scales from the view
  // box's corner, so a character flew in from the top left instead of walking in (story-parts.tsx FILL_BOX).
  describe('a group that arrives', () => {
    it('scales from its own box on every template', () => {
      let seen = 0;
      for (const { kind, svg } of markup) {
        for (const g of svg.match(/<g [^>]*class="[^"]*\bpv-arrive\b[^"]*"[^>]*>/g) ?? []) {
          seen++;
          expect(g, kind).toContain('transform-box:fill-box');
        }
      }
      if (expectArrivals) expect(seen).toBeGreaterThan(0);
    });
  });
}
