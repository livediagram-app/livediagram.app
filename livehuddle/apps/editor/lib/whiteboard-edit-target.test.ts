import { describe, expect, it, vi } from 'vitest';
import { createShape, createSticky, type Element } from '@livehuddle/document';
import { routeBoardDoubleClick, shapeToEditAt } from './whiteboard-edit-target';

// docs/specs/023-draw-mode/draw-mode.md "Selecting": a whiteboard shape is picked by its outline,
// yet a double-click anywhere inside it edits its label, selected or not.

const shape = (kind: Parameters<typeof createShape>[0], x: number, y: number, over = {}) =>
  ({ ...createShape(kind, x, y), width: 200, height: 100, ...over }) as Element;

describe('shapeToEditAt', () => {
  it('finds the shape whose drawn inside holds the point', () => {
    const rect = shape('square', 0, 0);
    expect(shapeToEditAt([rect], { x: 100, y: 50 })?.id).toBe(rect.id);
  });

  it('finds nothing outside every shape', () => {
    expect(shapeToEditAt([shape('square', 0, 0)], { x: 300, y: 50 })).toBeNull();
  });

  it('follows the drawn outline: outside an ellipse but inside its box is nothing', () => {
    expect(shapeToEditAt([shape('circle', 0, 0)], { x: 4, y: 4 })).toBeNull();
    expect(shapeToEditAt([shape('diamond', 0, 0)], { x: 10, y: 10 })).toBeNull();
  });

  it('takes the topmost of shapes stacked over the point', () => {
    const under = shape('square', 0, 0);
    const over = shape('circle', 50, 0);
    expect(shapeToEditAt([under, over], { x: 150, y: 50 })?.id).toBe(over.id);
  });

  it('turns the point into a rotated shape\u2019s own frame', () => {
    const turned = shape('square', 0, 0, { width: 200, height: 20, rotation: 90 });
    // Turned about its centre (100, 10), the bar stands upright from y -90 to 110.
    expect(shapeToEditAt([turned], { x: 100, y: 100 })?.id).toBe(turned.id);
    expect(shapeToEditAt([turned], { x: 20, y: 10 })).toBeNull();
  });

  it('edits a shape saved locked, and passes over one with no label to edit', () => {
    const locked = shape('square', 0, 0, { locked: true });
    const chart = shape('pie-chart', 0, 0);
    const p = { x: 100, y: 50 };
    expect(shapeToEditAt([locked], p)).not.toBeNull();
    expect(shapeToEditAt([chart], p)).toBeNull();
  });

  it('leaves notes and text boxes to their own double-click: they catch it on their whole box', () => {
    expect(shapeToEditAt([createSticky(0, 0)], { x: 20, y: 20 })).toBeNull();
  });
});

describe('routeBoardDoubleClick', () => {
  const rect = shape('square', 0, 0);
  const route = (whiteboard: boolean, p: { x: number; y: number }) => {
    const to = { edit: vi.fn(), board: vi.fn() };
    routeBoardDoubleClick({ whiteboard, elements: [rect] }, p, to);
    return to;
  };

  it('edits the shape a double-click lands inside on a whiteboard', () => {
    const to = route(true, { x: 100, y: 50 });
    expect(to.edit).toHaveBeenCalledWith(rect.id);
    expect(to.board).not.toHaveBeenCalled();
  });

  it('leaves a double-click beside every shape to the board', () => {
    const to = route(true, { x: 300, y: 50 });
    expect(to.board).toHaveBeenCalledWith(300, 50);
    expect(to.edit).not.toHaveBeenCalled();
  });

  it('leaves Diagram mode alone: there a shape catches its own double-click', () => {
    const to = route(false, { x: 100, y: 50 });
    expect(to.board).toHaveBeenCalledWith(100, 50);
    expect(to.edit).not.toHaveBeenCalled();
  });
});
