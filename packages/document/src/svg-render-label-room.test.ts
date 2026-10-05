import { describe, expect, it } from 'vitest';
import { createShape, createSticky, createTable, PADDING_PX, type BoxedElement } from './index';
import { drawsStandardLabel, labelRoom, selfLabelled } from './svg-render-describe';
import {
  estimatedLabelMeasure,
  LABEL_ESTIMATE_CHAR_EM,
  labelMaxWidth,
  labelMeasure,
} from './svg-render-primitives';
import { pageBodyTop } from './svg-render-page';

// The headless label measure and the label's room (docs/specs/024-agents/blueprints/diagram-lint.md LN4, LN5):
// what the lint and every headless render wrap with.

describe('estimatedLabelMeasure', () => {
  it('measures a share of the font size a character', () => {
    expect(estimatedLabelMeasure(20)('abcd')).toBe(4 * 20 * LABEL_ESTIMATE_CHAR_EM);
  });

  it('is what labelMeasure falls back to without a canvas', () => {
    expect(labelMeasure(16, false, false)('Orders service')).toBe(
      estimatedLabelMeasure(16)('Orders service'),
    );
  });
});

describe('drawsStandardLabel', () => {
  const shape = (kind: Parameters<typeof createShape>[0]) =>
    createShape(kind, 0, 0) as BoxedElement;

  it('is true for ordinary shapes and stickies', () => {
    expect(drawsStandardLabel(shape('square'))).toBe(true);
    expect(drawsStandardLabel(createSticky(0, 0))).toBe(true);
    expect(drawsStandardLabel(shape('chair'))).toBe(true);
  });

  it('is false for elements that draw their own text', () => {
    expect(drawsStandardLabel(createTable(0, 0))).toBe(false);
    expect(drawsStandardLabel(shape('code-block'))).toBe(false);
    expect(drawsStandardLabel(shape('legend'))).toBe(false);
    expect(drawsStandardLabel(shape('checklist'))).toBe(false);
    expect(drawsStandardLabel(shape('pie-chart'))).toBe(false);
    expect(selfLabelled(shape('pie-chart'))).toBe(true);
    expect(selfLabelled(shape('legend'))).toBe(false);
    expect(selfLabelled(createSticky(0, 0))).toBe(false);
  });

  it('is false for a stroke or a path', () => {
    const stroke = { id: 's', type: 'freehand', x: 0, y: 0, width: 10, height: 10, points: [] };
    const path = { id: 'p', type: 'path', x: 0, y: 0, width: 10, height: 10, nodes: [] };
    expect(drawsStandardLabel(stroke as unknown as BoxedElement)).toBe(false);
    expect(drawsStandardLabel(path as unknown as BoxedElement)).toBe(false);
  });
});

describe('labelRoom', () => {
  it('is the box inside its padding', () => {
    const el = {
      ...createShape('square', 10, 20),
      width: 200,
      height: 100,
      padding: 'md',
    } as BoxedElement;
    expect(labelRoom(el)).toEqual({
      width: labelMaxWidth(el, PADDING_PX.md),
      height: 100 - 2 * PADDING_PX.md,
    });
  });

  it("starts a page's room under its masthead", () => {
    const page = { ...createShape('page', 0, 0), width: 300, height: 400 } as BoxedElement;
    const pad = PADDING_PX[page.padding ?? 'lg'];
    expect(labelRoom(page).height).toBe(400 - pad - (pageBodyTop(page as never, pad) + pad));
  });
});
