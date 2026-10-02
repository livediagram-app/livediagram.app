'use client';

import { penColourCss } from '@livediagram/document';
import type { PendingDraw } from '@/lib/draw-mode';
import { useCanvasSurface } from '@/components/canvas/CanvasSurfaceContext';
import type { LiveStroke } from '@/lib/live-stroke';
import { useRecognitionPreview } from '@/hooks/canvas/useRecognitionPreview';
import { LiveInk } from '@/components/canvas/whiteboard/LiveInk';
import { RecognisedShapePreview } from '@/components/canvas/whiteboard/BoardShapePreview';
import { RecognitionChip } from '@/components/canvas/whiteboard/RecognitionChip';
import { flipStrokeRecognition } from '@/lib/recognition-flip';

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
// on and the pen held still (or Alt pressed), the shape the stroke reads as in its place, and on a
// pen or touch stroke held still the chip that flips it. One layer rasterises the preview and what
// lands, so release changes no pixel.
export function WhiteboardPenPreview({ stroke, pen, ink, zoom }: WhiteboardPenPreviewProps) {
  // A named colour in its version for this board, as the stroke that lands is drawn.
  // The canvas the stock colours are drawn for (docs/specs/007-editor/editor-modes.md "One look").
  const appearance = useCanvasSurface();
  const colour = penColourCss(pen.colour, appearance, ink);
  const { shape: recognised, chip } = useRecognitionPreview(stroke, pen.recognise, zoom, pen.width);
  return (
    <>
      <LiveInk stroke={stroke} colour={colour} width={pen.width} hidden={!!recognised} />
      {recognised ? (
        <RecognisedShapePreview shape={recognised} colour={colour} penWidth={pen.width} />
      ) : null}
      {chip ? (
        <RecognitionChip
          chip={chip}
          zoom={zoom}
          onFlip={() => flipStrokeRecognition(stroke, pen.width, 'chip')}
        />
      ) : null}
    </>
  );
}
