import { describe, expect, it } from 'vitest';
import { createShape, createSticky, PADDING_PX, type BoxedElement } from './index';
import { drawsStandardLabel, labelRoom, selfLabelled } from './svg-render-describe';
import {
  estimatedLabelMeasure,
  LABEL_ESTIMATE_CHAR_EM,
  labelMaxWidth,
  labelMeasure,
} from './svg-render-primitives';

// The headless label measure and the label's room: what every headless render wraps with.

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
    expect(drawsStandardLabel(shape('room'))).toBe(true);
    expect(drawsStandardLabel(createSticky(0, 0))).toBe(true);
    expect(drawsStandardLabel(shape('chair'))).toBe(true);
  });

  it('is false for elements that draw their own text', () => {
    expect(drawsStandardLabel(shape('plant'))).toBe(false);
    expect(selfLabelled(shape('plant'))).toBe(true);
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
      ...createShape('focus-button', 10, 20),
      width: 200,
      height: 100,
      padding: 'md',
    } as BoxedElement;
    expect(labelRoom(el)).toEqual({
      width: labelMaxWidth(el, PADDING_PX.md),
      height: 100 - 2 * PADDING_PX.md,
    });
  });
});
