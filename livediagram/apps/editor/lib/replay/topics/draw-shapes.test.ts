import { describe, expect, it } from 'vitest';
import type { ShapeElement, StickyElement, Tab } from '@livediagram/document';
import { CHAPTERS, RECT, SEARCH, shapes, STICKY, STICKY_TEXT } from './draw-shapes';

// Shapes and Stickies (docs/specs/023-draw-mode/draw-mode.md "Shapes"). What every topic holds is in topics.test.ts.

const env = { centre: { x: 400, y: 300 }, tab: { id: 't', elements: [] } as unknown as Tab };
const layout = shapes.layout(env);

describe('Shapes and Stickies', () => {
  it('plays Shapes, Sticky', () => {
    expect(CHAPTERS.map((c) => c.id)).toEqual(['shapes-rectangle', 'shapes-sticky']);
  });

  it('lands a rectangle as Draw writes one: an Ink outline, no fill', () => {
    expect(layout.rectangle).toMatchObject({
      shape: 'square',
      penColour: 'ink',
      fillColor: 'transparent',
    });
    expect(layout.sticky).toMatchObject({ type: 'sticky', width: 200, height: 200 });
  });

  it('opens Shapes, types "rectangle" into its search, picks it, and drags one out', () => {
    expect(shapes.frame(0, RECT.open, layout).open).toEqual(['dock-shapes']);
    expect(shapes.frame(0, RECT.type[1], layout).typed).toEqual({
      selector: SEARCH,
      text: 'rectangle',
    });
    const armed = shapes.frame(0, RECT.pick, layout);
    expect(armed.dock).toEqual({ tool: 'shape', armedShape: 'rectangle' });
    expect(shapes.frame(0, RECT.close, layout).open).toEqual([]);
    const mid = shapes.frame(0, (RECT.drag[0] + RECT.drag[1]) / 2, layout);
    const growing = mid.elements[0] as ShapeElement;
    expect(growing.width).toBeLessThan(layout.rectangle.width);
    expect(mid.hold).toEqual({ x: growing.x + growing.width, y: growing.y + growing.height });
    const done = shapes.frame(0, RECT.drag[1], layout);
    expect(done.elements).toEqual([layout.rectangle]);
    expect(done.selectedId).toBe(layout.rectangle.id);
    expect(done.dock).toBeUndefined();
  });

  it('searches "sticky", picks the note, clicks the board and types on it', () => {
    expect(shapes.frame(1, STICKY.type[1], layout).typed?.text).toBe('sticky');
    expect(shapes.frame(1, STICKY.pick, layout).dock?.armedShape).toBe('sticky');
    expect(shapes.frame(1, STICKY.place - 1, layout).elements).toEqual([layout.rectangle]);
    const placed = shapes.frame(1, STICKY.place, layout);
    expect(placed.selectedId).toBe(layout.sticky.id);
    expect(placed.typing).toBe(true);
    const end = shapes.frame(1, CHAPTERS[1]!.ms, layout);
    expect((end.elements[1] as StickyElement).label).toBe(STICKY_TEXT);
    expect(end.typing).toBe(false);
  });

  it('presses each result by its shape key in the open flyout', () => {
    const selectors = [0, 1].flatMap((i) =>
      shapes.plan(i, layout).flatMap((w) => (w.to.kind === 'find' ? [w.to.selector] : [])),
    );
    expect(selectors).toContain('#whiteboard-flyout-shapes [data-shape-option="rectangle"]');
    expect(selectors).toContain('#whiteboard-flyout-shapes [data-shape-option="sticky"]');
  });
});
