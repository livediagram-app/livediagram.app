import { describe, expect, it } from 'vitest';
import type { Tab } from '@livediagram/document';
import { RECOGNITION_PREVIEW_DWELL_MS } from '@/lib/recognition-preview';
import { recognised } from './draw-shared';
import {
  AGAIN,
  CHAPTERS,
  HOLD,
  RECOGNITION_OPTION,
  recognition,
  TURN_ON,
} from './draw-recognition';

// Shape Recognition (docs/specs/023-draw-mode/draw-mode.md "Shape recognition"). What every topic holds is in
// topics.test.ts.

const env = { centre: { x: 400, y: 300 }, tab: { id: 't', elements: [] } as unknown as Tab };
const layout = recognition.layout(env);

describe('Shape Recognition', () => {
  it('plays Turn On, Hold, Again, and names Alt', () => {
    expect(CHAPTERS.map((c) => c.id)).toEqual([
      'recognition-turn-on',
      'recognition-hold',
      'recognition-again',
    ]);
    expect(CHAPTERS[1]!.say).toMatch(/Alt/);
  });

  it('opens the Settings cog and presses Shape recognition, shown on but never stored', () => {
    expect(recognition.frame(0, TURN_ON.cog - 1, layout).open).toEqual([]);
    expect(recognition.frame(0, TURN_ON.cog, layout).open).toEqual(['dock-settings']);
    expect(recognition.frame(0, TURN_ON.option - 1, layout).dock?.prefs?.recognise).toBe(false);
    expect(recognition.frame(0, TURN_ON.option, layout).dock?.prefs?.recognise).toBe(true);
    expect(recognition.frame(0, TURN_ON.close, layout).open).toEqual([]);
    const names = recognition
      .plan(0, layout)
      .flatMap((w) => (w.to.kind === 'find' ? [w.to.selector] : []));
    expect(names).toContain(
      `#whiteboard-flyout-settings button[aria-label="${RECOGNITION_OPTION}"]`,
    );
  });

  it('reads the hand-drawn circle and box as the board does: an ellipse and a rectangle', () => {
    expect(recognised(layout.circle.points, layout.circle.pen)?.kind).toBe('circle');
    expect(recognised(layout.box.points, layout.box.pen)?.kind).toBe('square');
    expect(layout.ellipse).toMatchObject({
      shape: 'circle',
      fillColor: 'transparent',
      penColour: 'ink',
    });
    expect(layout.rectangle).toMatchObject({ shape: 'square', fillColor: 'transparent' });
  });

  it('draws the circle, holds still half a second, then shows the ellipse in its place', () => {
    expect(HOLD.snap - HOLD.draw[1]).toBe(RECOGNITION_PREVIEW_DWELL_MS);
    const drawing = recognition.frame(1, (HOLD.draw[0] + HOLD.draw[1]) / 2, layout);
    expect(drawing.elements.map((e) => e.type)).toEqual(['freehand']);
    const still = recognition.frame(1, HOLD.snap - 1, layout);
    expect(still.elements[0]!.type).toBe('freehand');
    expect(still.hold).toEqual(layout.circle.points.at(-1));
    const snapped = recognition.frame(1, HOLD.snap, layout);
    expect(snapped.elements).toEqual([layout.ellipse]);
    expect(snapped.hold).toEqual(still.hold);
    expect(recognition.frame(1, HOLD.lift, layout).hold).toBeNull();
  });

  it('keeps the ellipse while the box snaps beside it', () => {
    expect(recognition.frame(2, 0, layout).elements).toEqual([layout.ellipse]);
    expect(recognition.frame(2, AGAIN.snap, layout).elements).toEqual([
      layout.ellipse,
      layout.rectangle,
    ]);
    expect(recognition.frame(2, AGAIN.snap, layout).dock?.prefs?.recognise).toBe(true);
  });
});
