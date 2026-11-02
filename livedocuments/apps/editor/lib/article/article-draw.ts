// The writing's draw operations (article-snapshot.ts) painted: as SVG markup for the SVG export and for
// rasterising, or straight onto a canvas, whose text then uses the page's own loaded web fonts.
import type { ArticleDrawOp } from './article-snapshot';

export { articleOpsToSvg } from '@livedocuments/document';

// A line of several styles: each stretch after the one before, measured in its own font, the whole set at its anchor.
function drawRuns(ctx: CanvasRenderingContext2D, op: Extract<ArticleDrawOp, { k: 'text' }>): void {
  const fontOf = (r: { weight: string; style: string }) =>
    `${r.style} ${r.weight} ${op.size}px ${op.family}`;
  const widths = op.runs!.map((r) => {
    ctx.font = fontOf(r);
    return ctx.measureText(r.text).width;
  });
  const total = widths.reduce((a, w) => a + w, 0);
  let x = op.anchor === 'end' ? op.x - total : op.anchor === 'middle' ? op.x - total / 2 : op.x;
  ctx.textAlign = 'left';
  op.runs!.forEach((r, i) => {
    ctx.font = fontOf(r);
    ctx.fillText(r.text, x, op.y);
    x += widths[i]!;
  });
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
      ctx.setLineDash(op.dash ? [op.width, op.width * 2] : []);
      ctx.beginPath();
      ctx.moveTo(op.x1, op.y1);
      ctx.lineTo(op.x2, op.y2);
      ctx.stroke();
      ctx.setLineDash([]);
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
      if (op.runs) drawRuns(ctx, op);
      else ctx.fillText(op.text, op.x, op.y);
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
