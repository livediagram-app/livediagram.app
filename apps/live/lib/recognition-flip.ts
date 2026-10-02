// Alt (Option), or the chip on a touch screen, flips the stroke being drawn between ink and the
// shape it reads as (docs/specs/023-whiteboard/whiteboard.md "Shape recognition"), whichever way
// the recognition setting is, and never changes that setting.
import type { LiveStroke } from './live-stroke';
import { recogniseBoardStroke } from './recognition-preview';
import { track } from './telemetry';
import { debugLog } from '@/lib/debug-log';

export type RecognitionFlip = 'recognised' | 'broken';
/** How the flip was asked for: the Alt key, or a tap on the chip. */
export type RecognitionFlipVia = 'key' | 'chip';

/**
 * A shown shape breaks back to ink, exactly as drawn so far; ink is recognised at once and locks
 * as if the pen had held still. Null when the ink reads as no shape: it stays ink.
 */
export function flipRecognition(stroke: LiveStroke, penWidth: number): RecognitionFlip | null {
  if (stroke.unsnap()) return 'broken';
  const shape = recogniseBoardStroke(stroke.ink(penWidth));
  if (!shape) return null;
  stroke.snapTo(shape);
  return 'recognised';
}

/** `flipRecognition`, then redraws the stroke and reports the flip and how it was asked for. */
export function flipStrokeRecognition(
  stroke: LiveStroke,
  penWidth: number,
  via: RecognitionFlipVia,
): RecognitionFlip | null {
  const flip = flipRecognition(stroke, penWidth);
  debugLog(`[whiteboard] recognition flip by ${via}: ${flip ?? 'no shape'}`);
  if (!flip) return null;
  track(
    'Whiteboard',
    'Toggled',
    flip === 'recognised'
      ? via === 'key'
        ? 'RecogniseOnceKey'
        : 'RecogniseOnceChip'
      : via === 'key'
        ? 'BreakShapeKey'
        : 'BreakShapeChip',
  );
  stroke.notify();
  return flip;
}
