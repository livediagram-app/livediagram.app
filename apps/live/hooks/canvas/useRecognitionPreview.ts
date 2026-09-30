'use client';

// The recognised shape to preview while a whiteboard pen holds still, pressed, with recognition
// on (docs/specs/023-whiteboard/whiteboard.md "Shape recognition"). A timer restarts whenever the
// pen moves beyond the still radius; when it fires, the stroke so far is recognised. Whether the
// preview still holds is derived each render from the samples since, so moving on drops it at once.

import { useEffect, useRef, useState } from 'react';
import type { RecognisedShape } from '@livediagram/document';
import { simplifyPenStroke } from '@/lib/pen-smoothing';
import {
  RECOGNITION_PREVIEW_DWELL_MS,
  recogniseBoardStroke,
  stillSince,
} from '@/lib/recognition-preview';

type Point = { x: number; y: number };
type Preview = { shape: RecognisedShape; first: Point; count: number; anchor: Point };

export function useRecognitionPreview(
  points: Point[] | null,
  active: boolean,
  zoom: number,
): RecognisedShape | null {
  const [preview, setPreview] = useState<Preview | null>(null);
  const anchorRef = useRef<{ first: Point; at: Point; from: number } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const stop = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
    };
    if (!active || !points || points.length < 2) {
      stop();
      anchorRef.current = null;
      return;
    }
    const first = points[0]!;
    const last = points[points.length - 1]!;
    const anchor = anchorRef.current;
    const sameStroke = anchor?.first === first;
    if (sameStroke && stillSince(points, anchor.from, anchor.at, zoom)) return;
    // Moved on (or a new stroke): wait for the next pause from here.
    stop();
    anchorRef.current = { first, at: last, from: points.length - 1 };
    const snapshot = points;
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      const shape = recogniseBoardStroke(simplifyPenStroke(snapshot, zoom));
      if (shape) {
        console.debug('[whiteboard] recognition preview', shape.kind);
        setPreview({ shape, first, count: snapshot.length, anchor: last });
      }
    }, RECOGNITION_PREVIEW_DWELL_MS);
  }, [points, active, zoom]);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  if (!preview || !active || !points || points[0] !== preview.first) return null;
  if (points.length < preview.count) return null;
  return stillSince(points, preview.count - 1, preview.anchor, zoom) ? preview.shape : null;
}
