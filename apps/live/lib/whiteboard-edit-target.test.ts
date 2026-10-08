import { describe, expect, it, vi } from 'vitest';
import { createShape, createSticky, type Element, type Layer } from '@livediagram/document';
import { routeBoardDoubleClick, shapeToEditAt } from './whiteboard-edit-target';

// docs/specs/023-draw-mode/draw-mode.md "Selecting": a whiteboard shape is picked by its outline,
// yet a double-click anywhere inside it edits its label, selected or not.

const shape = (kind: Parameters<typeof createShape>[0], x: number, y: number, over = {}) =>
  ({ ...createShape(kind, x, y), width: 200, height: 100, ...over }) as Element;

const NONE: ReadonlySet<string> = new Set();

describe('shapeToEditAt', () => {
  it('finds the shape whose drawn inside holds the point', () => {
    const rect = shape('square', 0, 0);
    expect(shapeToEditAt([rect], { x: 100, y: 50 }, NONE)?.id).toBe(rect.id);
  });

  it('finds nothing outside every shape', () => {
    expect(shapeToEditAt([shape('square', 0, 0)], { x: 300, y: 50 }, NONE)).toBeNull();
  });

  it('follows the drawn outline: outside an ellipse but inside its box is nothing', () => {
    expect(shapeToEditAt([shape('circle', 0, 0)], { x: 4, y: 4 }, NONE)).toBeNull();
    expect(shapeToEditAt([shape('diamond', 0, 0)], { x: 10, y: 10 }, NONE)).toBeNull();
  });

  it('takes the topmost of shapes stacked over the point', () => {
    const under = shape('square', 0, 0);
    const over = shape('circle', 50, 0);
    expect(shapeToEditAt([under, over], { x: 150, y: 50 }, NONE)?.id).toBe(over.id);
  });

  it('turns the point into a rotated shape\u2019s own frame', () => {
    const turned = shape('square', 0, 0, { width: 200, height: 20, rotation: 90 });
    // Turned about its centre (100, 10), the bar stands upright from y -90 to 110.
    expect(shapeToEditAt([turned], { x: 100, y: 100 }, NONE)?.id).toBe(turned.id);
    expect(shapeToEditAt([turned], { x: 20, y: 10 }, NONE)).toBeNull();
  });

  it('passes over a shape that is locked, on an inert layer, or has no label to edit', () => {
    const locked = shape('square', 0, 0, { locked: true });
    const inert = shape('square', 0, 0);
    const chart = shape('pie-chart', 0, 0);
    const p = { x: 100, y: 50 };
    expect(shapeToEditAt([locked], p, NONE)).toBeNull();
    expect(shapeToEditAt([inert], p, new Set([inert.id]))).toBeNull();
    expect(shapeToEditAt([chart], p, NONE)).toBeNull();
  });

  it('leaves notes and text boxes to their own double-click: they catch it on their whole box', () => {
    expect(shapeToEditAt([createSticky(0, 0)], { x: 20, y: 20 }, NONE)).toBeNull();
  });
});

describe('routeBoardDoubleClick', () => {
  const rect = shape('square', 0, 0);
  const route = (whiteboard: boolean, p: { x: number; y: number }) => {
    const to = { edit: vi.fn(), board: vi.fn() };
    routeBoardDoubleClick(
      { whiteboard, elements: [rect], layers: undefined, inertIds: NONE },
      p,
      to,
    );
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

  it('never edits a shape on a hidden layer', () => {
    const hidden = { ...rect, layerId: 'l2' } as Element;
    const layers = [
      { id: 'l1', name: 'Base' },
      { id: 'l2', name: 'Hidden', visible: false },
    ];
    const to = { edit: vi.fn(), board: vi.fn() };
    routeBoardDoubleClick(
      { whiteboard: true, elements: [hidden], layers: layers as Layer[], inertIds: NONE },
      { x: 100, y: 50 },
      to,
    );
    expect(to.edit).not.toHaveBeenCalled();
    expect(to.board).toHaveBeenCalled();
  });
});
