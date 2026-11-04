'use client';

import { stageParts, type ShapeElement } from '@livehuddle/document';
import { SizedPieceView } from './RoomView';

// A stage (docs/specs/009-elements/office.md "Stage"): a raised platform, its top in the element's fill with two
// plank lines, the front edge's face shaded, and a plate on it where the element's own label (its name) sits. Drawn
// at its own size like a room, so the edge keeps its height however wide the stage. Whoever stands on it is heard by
// the whole tab (docs/specs/012-collaboration/meeting-rooms-and-stage.md "The stage"; lib/calls/stage.ts).
export function StageView({
  element,
  stroke,
  floor,
  animClass,
}: {
  element: ShapeElement;
  stroke: string;
  floor: string;
  animClass?: string;
}) {
  const { width, height } = element;
  return (
    <SizedPieceView
      parts={stageParts(width, height)}
      width={width}
      height={height}
      stroke={stroke}
      floor={floor}
      animClass={animClass}
      label={`Stage${element.label ? `, ${element.label}` : ''}`}
    />
  );
}
