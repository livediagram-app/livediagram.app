import { memo } from 'react';
import { bpmnMarkParts, type BpmnMarkPart, type BpmnSymbol } from '@livediagram/document';

// A shape's BPMN mark on the canvas (docs/specs/009-elements/bpmn.md "How it looks"): an event's ring and marker, a
// task's corner glyph, a gateway's marker, drawn over the shape in its line colour at fixed pixel sizes. The parts
// come from `bpmnMarkParts`, the same the export draws (svg-render-bpmn.ts), so the two cannot disagree. Memoised: it
// redraws only when the symbol, the box or a colour changes, never on a sibling's edit.

function paintOf(part: BpmnMarkPart, face: string, stroke: string) {
  switch (part.paint) {
    case 'line':
      return { fill: 'none', stroke, strokeWidth: part.width };
    case 'solid':
      return { fill: face, stroke, strokeWidth: part.width };
    case 'ink':
      return { fill: stroke, stroke: 'none' };
    case 'knock':
      return { fill: 'none', stroke: face, strokeWidth: part.width };
  }
}

export const BpmnMarkLayer = memo(function BpmnMarkLayer({
  symbol,
  width,
  height,
  fill,
  stroke,
}: {
  symbol: BpmnSymbol;
  width: number;
  height: number;
  // The face the marker parts take: the shape's fill, or the paper's default fill where it has none.
  fill: string;
  stroke: string;
}) {
  const parts = bpmnMarkParts(symbol, width, height);
  if (parts.length === 0) return null;
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      data-bpmn={symbol}
      aria-hidden
    >
      {parts.map((part, i) => (
        <path
          key={i}
          d={part.d}
          strokeLinecap="round"
          strokeLinejoin="round"
          {...paintOf(part, fill, stroke)}
        />
      ))}
    </svg>
  );
});
