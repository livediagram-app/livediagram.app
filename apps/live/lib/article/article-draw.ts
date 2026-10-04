// The writing's draw operations (article-snapshot.ts) painted: as SVG markup for the SVG export and for
// rasterising, or straight onto a canvas, whose text then uses the page's own loaded web fonts.
import { xmlEscape } from '@livediagram/icons';
import type { ArticleDrawOp } from './article-snapshot';

const r2 = (n: number) => Math.round(n * 100) / 100;

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
        `<text x="${r2(op.x)}" y="${r2(op.y)}" font-family="${xmlEscape(op.family)}" font-size="${r2(op.size)}" font-weight="${xmlEscape(op.weight)}"${op.style !== 'normal' ? ` font-style="${xmlEscape(op.style)}"` : ''} fill="${xmlEscape(op.color)}"${deco ? ` text-decoration="${deco}"` : ''}${op.anchor && op.anchor !== 'start' ? ` text-anchor="${op.anchor}"` : ''} xml:space="preserve">${xmlEscape(op.text)}</text>`,
      );
    }
  }
  out.push('</g>');
  return out.join('');
}

/** The operations painted onto a canvas already set to canvas coordinates. */
export function drawArticleOps(ctx: CanvasRenderingContext2D, ops: readonly ArticleDrawOp[]): void {
  ctx.save();
  for (const op of ops) {
    if (op.k === 'rect') {
      ctx.fillStyle = op.fill;
      ctx.beginPath();
      if (op.r && ctx.roundRect) ctx.roundRect(op.x, op.y, op.w, op.h, op.r);
      else ctx.rect(op.x, op.y, op.w, op.h);
      ctx.fill();
    } else if (op.k === 'line') {
      ctx.strokeStyle = op.stroke;
      ctx.lineWidth = op.width;
      ctx.beginPath();
      ctx.moveTo(op.x1, op.y1);
      ctx.lineTo(op.x2, op.y2);
      ctx.stroke();
    } else if (op.k === 'check') {
      const { x, y, size: z } = op;
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = op.stroke;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(x + 0.75, y + 0.75, z - 1.5, z - 1.5, 4);
      else ctx.rect(x + 0.75, y + 0.75, z - 1.5, z - 1.5);
      if (op.done) {
        ctx.fillStyle = op.stroke;
        ctx.fill();
      }
      ctx.stroke();
      if (op.done) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x + z * 0.28, y + z * 0.52);
        ctx.lineTo(x + z * 0.44, y + z * 0.69);
        ctx.lineTo(x + z * 0.74, y + z * 0.33);
        ctx.stroke();
      }
    } else {
      ctx.font = `${op.style} ${op.weight} ${op.size}px ${op.family}`;
      ctx.fillStyle = op.color;
      ctx.textBaseline = 'alphabetic';
      ctx.textAlign = op.anchor === 'end' ? 'right' : op.anchor === 'middle' ? 'center' : 'left';
      ctx.fillText(op.text, op.x, op.y);
      if (op.underline || op.strike) {
        const w = ctx.measureText(op.text).width;
        const x0 = op.anchor === 'end' ? op.x - w : op.anchor === 'middle' ? op.x - w / 2 : op.x;
        ctx.fillRect(
          x0,
          op.underline ? op.y + op.size * 0.12 : op.y - op.size * 0.3,
          w,
          Math.max(1, op.size / 16),
        );
      }
    }
  }
  ctx.restore();
}
