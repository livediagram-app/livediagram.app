'use client';

// What a whiteboard pen stroke shows while it is drawn, beyond its ink (docs/specs/023-whiteboard/
// whiteboard.md "Shape recognition"): the shape it is locked to, and on a pen or touch stroke the
// chip that flips it. Subscribed to the live stroke: each update checks only the samples added
// since the last one, and any sample beyond the still radius moves the anchor, sends the chip
// away and restarts the dwell timer. When it fires with recognition on, the stroke's centre line
// is recognised and the stroke locks to that shape: dragging on reshapes it (LiveStroke.shaped).
// Whatever locks or breaks the stroke (the dwell, Alt, the chip) the shown shape follows
// `shaped()`, so what shows is what lands.

import { useEffect, useState } from 'react';
import type { RecognisedShape } from '@livediagram/document';
import type { LiveStroke } from '@/lib/live-stroke';
import {
  RECOGNITION_PREVIEW_DWELL_MS,
  recogniseBoardStroke,
  stillSince,
} from '@/lib/recognition-preview';
import { debugLog } from '@/lib/debug-log';

type Point = { x: number; y: number };

/** The chip's offer: make the ink a shape, or keep drawing out of the shape shown. */
export type RecognitionChipAction = 'make' | 'keep';
/** The chip, where the pen holds still (canvas px). */
export type RecognitionChipState = { action: RecognitionChipAction; at: Point };

export type RecognitionView = {
  /** The shape the stroke shows in place of its ink; null while it shows as ink. */
  shape: RecognisedShape | null;
  /** The chip on a pen or touch stroke held still; null for a mouse, or while the pen moves. */
  chip: RecognitionChipState | null;
};

const NOTHING: RecognitionView = { shape: null, chip: null };

type Shown = RecognitionView & { stroke: LiveStroke };

export function useRecognitionPreview(
  stroke: LiveStroke | null,
  active: boolean,
  zoom: number,
  penWidth: number,
): RecognitionView {
  const [shown, setShown] = useState<Shown | null>(null);

  useEffect(() => {
    if (!stroke) return;
    // A mouse has Alt; a pen or a finger gets the chip.
    const chips = stroke.pointer !== 'mouse';
    // Recognition off on a mouse: nothing to wait for, Alt alone locks it.
    const dwells = active || chips;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let anchor: Point | null = null;
    // Samples already checked against the anchor.
    let checked = 0;
    let chip: RecognitionChipAction | null = null;
    const publish = () => {
      const shape = stroke.shaped();
      const at = anchor;
      setShown((prev) =>
        prev?.stroke === stroke &&
        prev.shape === shape &&
        prev.chip?.action === chip &&
        prev.chip?.at === at
          ? prev
          : { stroke, shape, chip: chip && at ? { action: chip, at } : null },
      );
    };
    const fire = () => {
      timer = null;
      const read = stroke.shaped() ? null : recogniseBoardStroke(stroke.ink(penWidth));
      // Alt held keeps it ink: holding still does not snap it again.
      if (read && active && !stroke.inkHeld()) {
        debugLog('[whiteboard] recognition preview', read.kind);
        // The stroke is the shape from here on: dragging on reshapes it. Shown as shaped() reads,
        // so a Shift already held shows it perfect, as release would land it.
        stroke.snapTo(read);
      }
      chip = !chips ? null : stroke.shaped() ? 'keep' : read ? 'make' : null;
      if (chip) debugLog('[whiteboard] recognition chip', chip);
      publish();
    };
    const onUpdate = () => {
      const count = stroke.points.length;
      if (count === 0) return;
      const from = checked;
      checked = count;
      if (anchor && stillSince((i) => stroke.points[i]!, from, count, anchor, zoom)) {
        // Still: a flip (Alt or the chip) while the chip shows turns its offer round.
        if (chip === 'make' && stroke.shaped()) chip = 'keep';
        else if (chip === 'keep' && !stroke.shaped()) {
          chip = recogniseBoardStroke(stroke.ink(penWidth)) ? 'make' : null;
        }
      } else {
        // Moved on (or the first update): the chip leaves, and the next pause is waited for here.
        anchor = stroke.points[count - 1]!;
        chip = null;
        if (timer) clearTimeout(timer);
        // A locked mouse stroke has nothing left to wait for.
        const waits = dwells && (chips || !stroke.shaped());
        timer = waits ? setTimeout(fire, RECOGNITION_PREVIEW_DWELL_MS) : null;
      }
      publish();
    };
    onUpdate();
    const unsubscribe = stroke.subscribe(onUpdate);
    return () => {
      unsubscribe();
      if (timer) clearTimeout(timer);
    };
  }, [stroke, active, zoom, penWidth]);

  return shown && shown.stroke === stroke ? shown : NOTHING;
}
