'use client';

// The recognised shape to preview while a whiteboard pen holds still, pressed, with recognition
// on (docs/specs/023-whiteboard/whiteboard.md "Shape recognition"). Subscribed to the live stroke:
// until a shape shows, each update checks only the samples added since the last one, and any
// sample beyond the still radius moves the anchor and restarts the dwell timer. When it fires, the
// stroke's centre line is recognised and the stroke locks to that shape: dragging on reshapes it
// (LiveStroke.shaped), and the stroke never comes back.

import { useEffect, useState } from 'react';
import type { RecognisedShape } from '@livediagram/document';
import type { LiveStroke } from '@/lib/live-stroke';
import {
  RECOGNITION_PREVIEW_DWELL_MS,
  recogniseBoardStroke,
  stillSince,
} from '@/lib/recognition-preview';

type Preview = { stroke: LiveStroke; shape: RecognisedShape };

export function useRecognitionPreview(
  stroke: LiveStroke | null,
  active: boolean,
  zoom: number,
  penWidth: number,
): RecognisedShape | null {
  const [preview, setPreview] = useState<Preview | null>(null);

  useEffect(() => {
    if (!stroke || !active) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let anchor: { x: number; y: number } | null = null;
    // Samples already checked against the anchor.
    let checked = 0;
    const fire = () => {
      timer = null;
      const shape = recogniseBoardStroke(stroke.ink(penWidth));
      if (!shape) return;
      console.debug('[whiteboard] recognition preview', shape.kind);
      // The stroke is the shape from here on: dragging on reshapes it.
      stroke.snapTo(shape);
      setPreview({ stroke, shape });
    };
    const onUpdate = () => {
      const count = stroke.points.length;
      if (count === 0) return;
      const shaped = stroke.shaped();
      if (shaped) {
        setPreview({ stroke, shape: shaped });
        return;
      }
      const from = checked;
      checked = count;
      if (anchor && stillSince((i) => stroke.points[i]!, from, count, anchor, zoom)) return;
      // Moved on (or the first update): wait for the next pause from here.
      anchor = stroke.points[count - 1]!;
      setPreview((p) => (p === null ? p : null));
      if (timer) clearTimeout(timer);
      timer = setTimeout(fire, RECOGNITION_PREVIEW_DWELL_MS);
    };
    onUpdate();
    const unsubscribe = stroke.subscribe(onUpdate);
    return () => {
      unsubscribe();
      if (timer) clearTimeout(timer);
    };
  }, [stroke, active, zoom, penWidth]);

  return preview && active && preview.stroke === stroke ? preview.shape : null;
}
