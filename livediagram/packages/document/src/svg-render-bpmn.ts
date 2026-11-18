// A BPMN mark in an exported image (docs/specs/009-elements/bpmn.md "How it looks"): the same parts the canvas's
// BpmnMarkLayer draws (bpmnMarkParts), at element coordinates, so a PNG or SVG matches the canvas.
import { bpmnMarkParts, bpmnSymbolOf, type BpmnMarkPart } from './bpmn';
import { r2, xmlEscape } from './svg-render-primitives';

function paintAttrs(part: BpmnMarkPart, fill: string, stroke: string): string {
  const width = ` stroke-width="${r2(part.width)}" stroke-linecap="round" stroke-linejoin="round"`;
  switch (part.paint) {
    case 'line':
      return ` fill="none" stroke="${xmlEscape(stroke)}"${width}`;
    case 'solid':
      return ` fill="${xmlEscape(fill)}" stroke="${xmlEscape(stroke)}"${width}`;
    case 'ink':
      return ` fill="${xmlEscape(stroke)}" stroke="none"`;
    case 'knock':
      return ` fill="none" stroke="${xmlEscape(fill)}"${width}`;
  }
}

/** The face a mark's `solid` and `knock` parts take: the shape's fill, or white where it has none. */
export function bpmnMarkFace(fill: string): string {
  return fill === 'transparent' || fill === 'none' || fill === '' ? '#ffffff' : fill;
}

/** A shape's BPMN mark as markup over its box; '' for a shape without one. */
export function svgBpmnMarks(
  el: { shape?: string; bpmn?: unknown; x: number; y: number; width: number; height: number },
  fill: string,
  stroke: string,
): string {
  const symbol = bpmnSymbolOf(el);
  if (!symbol) return '';
  const parts = bpmnMarkParts(symbol, el.width, el.height);
  if (parts.length === 0) return '';
  const face = bpmnMarkFace(fill);
  return `<g data-bpmn="${symbol}" transform="translate(${r2(el.x)} ${r2(el.y)})">${parts
    .map((part) => `<path d="${part.d}"${paintAttrs(part, face, stroke)}/>`)
    .join('')}</g>`;
}
