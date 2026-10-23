// An article's writing as draw operations (docs/specs/007-editor/article-pages.md "Everywhere a page goes"): each
// word where it lands, with its font and colour, each painted background, border, list marker and to-do box, in
// canvas coordinates; and those operations as SVG markup. The editor reads them off its live layout
// (apps/editor/lib/article/article-snapshot.ts); a preview without a browser estimates them (article-layout-estimate.ts).
// Pure.
import { r2, xmlEscape } from './svg-render-primitives';

export type ArticleDrawOp =
  | {
      k: 'text';
      x: number;
      // The alphabetic baseline.
      y: number;
      text: string;
      family: string;
      size: number;
      weight: string;
      style: string;
      color: string;
      underline?: boolean;
      strike?: boolean;
      anchor?: 'start' | 'middle' | 'end';
      // A line in more than one style (a bold lead-in): its stretches in order, each its own weight and style, `text`
      // their whole; drawn as one text whose stretches follow each other, so the renderer spaces them.
      runs?: { text: string; weight: string; style: string }[];
    }
  | { k: 'rect'; x: number; y: number; w: number; h: number; fill: string; r?: number }
  | { k: 'line'; x1: number; y1: number; x2: number; y2: number; stroke: string; width: number }
  | { k: 'check'; x: number; y: number; size: number; stroke: string; done: boolean };

/** The operations as SVG markup in canvas coordinates. */
export function articleOpsToSvg(ops: readonly ArticleDrawOp[]): string {
  const out: string[] = ['<g data-article-writing="">'];
  for (const op of ops) {
    if (op.k === 'rect') {
      out.push(
        `<rect x="${r2(op.x)}" y="${r2(op.y)}" width="${r2(op.w)}" height="${r2(op.h)}"${op.r ? ` rx="${r2(op.r)}"` : ''} fill="${xmlEscape(op.fill)}"/>`,
      );
    } else if (op.k === 'line') {
      out.push(
        `<line x1="${r2(op.x1)}" y1="${r2(op.y1)}" x2="${r2(op.x2)}" y2="${r2(op.y2)}" stroke="${xmlEscape(op.stroke)}" stroke-width="${r2(op.width)}"/>`,
      );
    } else if (op.k === 'check') {
      const { x, y, size: z } = op;
      out.push(
        `<rect x="${r2(x + 0.75)}" y="${r2(y + 0.75)}" width="${r2(z - 1.5)}" height="${r2(z - 1.5)}" rx="4" fill="${op.done ? xmlEscape(op.stroke) : 'none'}" stroke="${xmlEscape(op.stroke)}" stroke-width="1.5"/>`,
      );
      if (op.done)
        out.push(
          `<path d="M${r2(x + z * 0.28)} ${r2(y + z * 0.52)}l${r2(z * 0.16)} ${r2(z * 0.17)}l${r2(z * 0.3)} ${r2(-z * 0.36)}" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
        );
    } else {
      const deco = [op.underline ? 'underline' : '', op.strike ? 'line-through' : '']
        .filter(Boolean)
        .join(' ');
      out.push(
        `<text x="${r2(op.x)}" y="${r2(op.y)}" font-family="${xmlEscape(op.family)}" font-size="${r2(op.size)}" font-weight="${xmlEscape(op.weight)}"${op.style !== 'normal' ? ` font-style="${xmlEscape(op.style)}"` : ''} fill="${xmlEscape(op.color)}"${deco ? ` text-decoration="${deco}"` : ''}${op.anchor && op.anchor !== 'start' ? ` text-anchor="${op.anchor}"` : ''} xml:space="preserve">${
          op.runs
            ? op.runs
                .map(
                  (r) =>
                    `<tspan font-weight="${xmlEscape(r.weight)}"${r.style !== 'normal' ? ` font-style="${xmlEscape(r.style)}"` : ''}>${xmlEscape(r.text)}</tspan>`,
                )
                .join('')
            : xmlEscape(op.text)
        }</text>`,
      );
    }
  }
  out.push('</g>');
  return out.join('');
}
