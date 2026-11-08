import { describe, expect, it } from 'vitest';
import type { FreehandElement, Tab } from '@livediagram/document';
import { CHAPTERS, DRAW, MARKER, PICK_UP, sketch } from './draw-sketch';

// Sketch (docs/specs/007-editor/watch-it-built.md "The curriculum", Draw). What every topic holds is in topics.test.ts.

const env = {
  centre: { x: 400, y: 300 },
  size: { width: 1440, height: 820 },
  tab: { id: 't', elements: [] } as unknown as Tab,
};
const layout = sketch.layout(env);

describe('Sketch', () => {
  it('plays Pick Up, Draw', () => {
    expect(CHAPTERS.map((c) => c.id)).toEqual(['sketch-pick-up', 'sketch-draw']);
  });

  it('presses the first marker on the dock, which then shows in hand, and draws nothing yet', () => {
    expect(sketch.frame(0, PICK_UP.press - 1, layout).dock).toBeUndefined();
    const picked = sketch.frame(0, PICK_UP.press, layout);
    expect(picked.dock).toEqual({ tool: 'pen', prefs: { activePenId: MARKER } });
    expect(picked.elements).toEqual([]);
    const press = sketch.plan(0, layout)[0]!;
    expect(press).toMatchObject({ at: PICK_UP.press, press: true });
    expect(press.to).toEqual({
      kind: 'find',
      selector: '[data-whiteboard-dock] [data-dock-item="main"]',
    });
  });

  it('draws the line, then the walls, roof and door, each under the held cursor, in the ink', () => {
    const ids = (ms: number) => sketch.frame(1, ms, layout).elements.map((e) => e.id);
    expect(ids(DRAW.line[0] - 1)).toEqual([]);
    expect(sketch.frame(1, (DRAW.walls[0] + DRAW.walls[1]) / 2, layout).hold).not.toBeNull();
    expect(sketch.frame(1, DRAW.walls[1] + 100, layout).hold).toBeNull();
    const end = sketch.frame(1, CHAPTERS[1]!.ms, layout);
    expect(end.elements.map((e) => e.id)).toEqual([
      'wib-sketch-line',
      'wib-sketch-walls',
      'wib-sketch-roof',
      'wib-sketch-door',
    ]);
    for (const el of end.elements as FreehandElement[]) {
      expect(el).toMatchObject({ type: 'freehand', penWidth: 1.5, closed: false });
      expect(el.penColour).toBeUndefined();
    }
    expect(end.dock).toEqual({ tool: 'pen', prefs: { activePenId: MARKER } });
  });

  it('keeps the drawing in the space above the player, round the centre', () => {
    for (const s of layout.strokes)
      for (const p of s.points) {
        expect(Math.abs(p.x - 400)).toBeLessThan(180);
        expect(p.y).toBeLessThan(300 + 80);
      }
  });

  it('meets each stroke at its first point as it starts', () => {
    const plan = sketch.plan(1, layout);
    layout.strokes.forEach((s, i) => {
      expect(plan[i]).toEqual({ at: s.from, to: { kind: 'canvas', ...s.points[0]! } });
    });
  });
});
