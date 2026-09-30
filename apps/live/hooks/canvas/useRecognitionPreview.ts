'use client';

// The recognised shape to preview while a whiteboard pen holds still, pressed, with recognition
// on (docs/specs/023-whiteboard/whiteboard.md "Shape recognition"). Subscribed to the live stroke:
// each update checks only the samples added since the last one, and any sample beyond the still
// radius moves the anchor, drops a shown preview and restarts the dwell timer. When it fires, the
// pipeline's current points are recognised: the same points release would land.

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
): RecognisedShape | null {
  const [preview, setPreview] = useState<Preview | null>(null);

  useEffect(() => {
    if (!stroke || !active) return;
    const smoother = stroke.smoother;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let anchor: { x: number; y: number } | null = null;
    // Samples already checked against the anchor. The newest is checked again each time, since a
    // sample at the same instant may replace it.
    let checked = 0;
    const fire = () => {
      timer = null;
      const shape = recogniseBoardStroke(smoother.points());
      if (!shape) return;
      console.debug('[whiteboard] recognition preview', shape.kind);
      setPreview({ stroke, shape });
    };
    const onUpdate = () => {
      const count = smoother.sampleCount;
      if (count === 0) return;
      const from = Math.max(0, checked - 1);
      checked = count;
      if (anchor && stillSince((i) => smoother.sample(i), from, count, anchor, zoom)) return;
      // Moved on (or the first update): wait for the next pause from here.
      anchor = smoother.sample(count - 1);
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
  }, [stroke, active, zoom]);

  return preview && active && preview.stroke === stroke ? preview.shape : null;
}
