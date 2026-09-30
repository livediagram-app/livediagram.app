'use client';

import type { PendingDraw } from '@/lib/draw-mode';
import type { LiveStroke } from '@/lib/live-stroke';
import { useRecognitionPreview } from '@/hooks/canvas/useRecognitionPreview';
import { LiveInk } from '@/components/canvas/whiteboard/LiveInk';
import { RecognisedShapePreview } from '@/components/canvas/whiteboard/BoardShapePreview';

type WhiteboardPenPreviewProps = {
  stroke: LiveStroke;
  pen: Extract<PendingDraw, { variant: 'whiteboard' }>;
  /** The board's ink: the main pen's colour. */
  ink: string;
  zoom: number;
};

// What a whiteboard pen shows while it draws (docs/specs/023-whiteboard/whiteboard.md "Pens",
// "Shape recognition"), rendered INSIDE the canvas's transformed layer beside the committed
// elements, in canvas px: the live ink, laid out as the stroke it lands as, and, with recognition
// on and the pen held still, the shape the stroke reads as in its place. One layer rasterises the
// preview and what lands, so release changes no pixel.
export function WhiteboardPenPreview({ stroke, pen, ink, zoom }: WhiteboardPenPreviewProps) {
  const colour = pen.colour ?? ink;
  const recognised = useRecognitionPreview(stroke, pen.recognise, zoom, pen.width);
  return (
    <>
      <LiveInk stroke={stroke} colour={colour} width={pen.width} hidden={!!recognised} />
      {recognised ? (
        <RecognisedShapePreview shape={recognised} colour={colour} penWidth={pen.width} />
      ) : null}
    </>
  );
}
