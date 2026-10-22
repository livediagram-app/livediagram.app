import type { ReactNode } from 'react';
import {
  arrowheadPoints,
  timelineLayout,
  type ConceptRow,
  type LayoutRect,
} from '@livedocuments/document';
import { ConceptRowLayer } from './concept-row-layer';

// What ConceptFace hands a kind's body to draw its words with (its `line`), so every kind edits in place alike.
type Line = (
  i: number,
  rect: LayoutRect,
  value: string,
  px: number,
  colour: string,
  opts: { note?: boolean; align?: 'left' | 'center'; bold?: boolean; muted?: boolean },
) => ReactNode;

// The Timeline (docs/specs/009-elements/concept-graphics.md "Timeline"): the spine and its arrowhead in the accent,
// then each milestone in reading order (so Build brings them in left to right), a dot in the accent ringed in the fill,
// its stem, its when in the accent and its name in the ink, taking turns above and below the spine. The export draws
// the same from the same layout (svg-render-timeline.ts).
export function ConceptTimelineBody({
  width,
  height,
  rows,
  accent,
  fill,
  ink,
  line,
}: {
  width: number;
  height: number;
  rows: readonly ConceptRow[];
  accent: string;
  fill: string;
  ink: string;
  line: Line;
}) {
  const l = timelineLayout(width, height, rows.length);
  const svg = (child: ReactNode) => (
    <svg aria-hidden className="absolute inset-0 overflow-visible" width={width} height={height}>
      {child}
    </svg>
  );
  return (
    <>
      {svg(
        <>
          <line
            x1={l.spine.x1}
            y1={l.spine.y}
            x2={l.spine.x2}
            y2={l.spine.y}
            stroke={accent}
            strokeOpacity={0.55}
            strokeWidth={3}
            strokeLinecap="round"
          />
          <polygon points={arrowheadPoints(l.head.tip, 0, l.head.size)} fill={accent} />
        </>,
      )}
      {rows.map((row, i) => {
        const m = l.milestones[i]!;
        return (
          <ConceptRowLayer key={i} i={i} origin={m.dot}>
            {svg(
              <>
                <line
                  x1={m.dot.x}
                  y1={m.stem.y1}
                  x2={m.dot.x}
                  y2={m.stem.y2}
                  stroke={accent}
                  strokeOpacity={0.5}
                  strokeWidth={1.5}
                />
                <circle
                  cx={m.dot.x}
                  cy={m.dot.y}
                  r={l.dotR}
                  fill={accent}
                  stroke={fill}
                  strokeWidth={3}
                />
              </>,
            )}
            {line(i, m.note, row.note ?? '', l.notePx, accent, { note: true, muted: false })}
            {line(i, m.label, row.label, l.labelPx, ink, {})}
          </ConceptRowLayer>
        );
      })}
    </>
  );
}
