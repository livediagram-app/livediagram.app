import { describe, expect, it } from 'vitest';
import { createPath } from '@livedesign/document';
import {
  heldMarker,
  inkPath,
  whiteboardPenIntent,
  STROKE_HIT_SCREEN_PX,
  strokeHitWidth,
} from './whiteboard-tool';
import { DEFAULT_WHITEBOARD_PREFS } from './whiteboard-prefs';

describe('whiteboardPenIntent', () => {
  it('carries the pen colour, width and id', () => {
    expect(whiteboardPenIntent({ id: 'third', colour: '#e5484d', width: 8 })).toEqual({
      type: 'freehand',
      variant: 'whiteboard',
      colour: '#e5484d',
      width: 8,
      penId: 'third',
    });
  });
});

describe('heldMarker', () => {
  it('names the marker the armed intent picks up, and none for any other tool', () => {
    const prefs = DEFAULT_WHITEBOARD_PREFS;
    const second = prefs.pens[1]!;
    expect(heldMarker(whiteboardPenIntent(second), prefs)).toEqual(second);
    expect(heldMarker({ type: 'freehand', variant: 'highlighter' }, prefs)).toBe(null);
    expect(heldMarker(null, prefs)).toBe(null);
  });
});

// docs/specs/023-draw-mode/path-tool.md "Drawing": the Pen writes Ink, unfilled, onto its path.
describe('inkPath', () => {
  it('writes an Ink line and no fill on a path', () => {
    const path = createPath(
      [
        { x: 0, y: 0, mode: 'corner' },
        { x: 9, y: 9, mode: 'corner' },
      ],
      false,
    );
    expect(inkPath(path)).toMatchObject({ penColour: 'ink', fillColor: 'transparent' });
  });
});

describe('strokeHitWidth', () => {
  it('pads the line by a steady on-screen margin each side, at any zoom', () => {
    expect(STROKE_HIT_SCREEN_PX).toBe(6);
    expect(strokeHitWidth(1.5, 1)).toBe(13.5);
    expect(strokeHitWidth(1.5, 2)).toBe(7.5);
  });
});
