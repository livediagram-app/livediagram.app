// The marks a Plan tab's still pictures are drawn with (docs/specs/026-plan/plan-tabs.md "Export"): boxes, text and a
// view's frame (its card, a header of its name and count), in the board's palette, so a picture reads like the live
// view it stands for. Pure: markup strings at canvas coordinates.
import { svgFitLine, svgText, type PlanPalette } from '@livepages/document';
import { xmlEscape } from '@livepages/icons';

export type Rect = { x: number; y: number; width: number; height: number };

export const r2 = (n: number) => Math.round(n * 100) / 100;

// The font every Plan picture sets once, as the boards' export does.
const PLAN_ART_FONT = 'system-ui, sans-serif';
export const inPlanFont = (body: string) => `<g font-family="${PLAN_ART_FONT}">${body}</g>`;

// The live views' header (view-layout VIEW_HEADER_PX) and padding.
const ART_HEADER_H = 40;
export const ART_PAD = 12;

export function box(
  r: Rect,
  o: { fill: string; stroke?: string; rx?: number; opacity?: number; strokeWidth?: number },
): string {
  return (
    `<rect x="${r2(r.x)}" y="${r2(r.y)}" width="${r2(Math.max(0, r.width))}" height="${r2(Math.max(0, r.height))}"` +
    ` rx="${o.rx ?? 0}" fill="${xmlEscape(o.fill)}"` +
    (o.opacity !== undefined && o.opacity < 1 ? ` fill-opacity="${r2(o.opacity)}"` : '') +
    (o.stroke ? ` stroke="${xmlEscape(o.stroke)}" stroke-width="${o.strokeWidth ?? 1}"` : '') +
    '/>'
  );
}

// One line of text, cut with an ellipsis to `width` when given.
export function line(
  x: number,
  y: number,
  body: string,
  o: {
    size: number;
    color: string;
    weight?: number;
    anchor?: 'start' | 'middle' | 'end';
    width?: number;
    strike?: boolean;
  },
): string {
  const shown = o.width !== undefined ? svgFitLine(body, Math.max(0, o.width), o.size) : body;
  if (!shown) return '';
  return svgText(x, y, shown, {
    size: o.size,
    color: o.color,
    ...(o.weight ? { weight: o.weight } : {}),
    ...(o.anchor ? { anchor: o.anchor } : {}),
    ...(o.strike ? { strike: true } : {}),
  });
}

export const dot = (cx: number, cy: number, r: number, fill: string) =>
  `<circle cx="${r2(cx)}" cy="${r2(cy)}" r="${r2(r)}" fill="${xmlEscape(fill)}"/>`;

// A view's card and header (view-frame.tsx ViewFrame): its name at the left, its count in a badge after it, a rule
// under the header. Returns the markup and the body's rect.
export function viewFrame(
  r: Rect,
  p: PlanPalette,
  title: string,
  count?: number,
): { markup: string; body: Rect } {
  const parts = [box(r, { fill: p.surface, stroke: p.border, rx: 12 })];
  const titleW = Math.max(0, r.width - ART_PAD * 2 - (count !== undefined ? 48 : 0));
  const fitted = svgFitLine(title, titleW, 13);
  parts.push(line(r.x + ART_PAD, r.y + 25, fitted, { size: 13, weight: 600, color: p.text }));
  if (count !== undefined) {
    const label = String(count);
    const at = r.x + ART_PAD + Math.min(titleW, fitted.length * 13 * 0.56) + 8;
    const w = 12 + label.length * 7;
    parts.push(box({ x: at, y: r.y + 11, width: w, height: 18 }, { fill: p.column, rx: 9 }));
    parts.push(
      line(at + w / 2, r.y + 24, label, { size: 11, weight: 600, color: p.text, anchor: 'middle' }),
    );
  }
  parts.push(
    `<line x1="${r2(r.x)}" y1="${r2(r.y + ART_HEADER_H)}" x2="${r2(r.x + r.width)}" y2="${r2(r.y + ART_HEADER_H)}" stroke="${xmlEscape(p.border)}" stroke-width="1"/>`,
  );
  return {
    markup: parts.join(''),
    body: {
      x: r.x,
      y: r.y + ART_HEADER_H,
      width: r.width,
      height: Math.max(0, r.height - ART_HEADER_H),
    },
  };
}

// A view's body when it has nothing to show: its quiet line, centred.
export function emptyBody(body: Rect, p: PlanPalette, message: string): string {
  return line(body.x + body.width / 2, body.y + body.height / 2 + 4, message, {
    size: 12,
    color: p.muted,
    anchor: 'middle',
    width: body.width - ART_PAD * 2,
  });
}
