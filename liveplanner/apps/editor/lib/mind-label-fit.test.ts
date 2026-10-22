import { describe, expect, it, vi } from 'vitest';
import {
  LABEL_FONT_PX,
  PADDING_PX,
  createShape,
  type Element,
  type ShapeElement,
} from '@liveplanner/project';
import { fitMindLabel, mindLabelFontPx, mindLabelHeight, mindLabelPadding } from './mind-label-fit';

// docs/specs/009-elements/mind-node.md "A node grows to fit its label".

const mind = (patch: Partial<ShapeElement> = {}): ShapeElement => ({
  ...createShape('mind-node', 0, 0),
  id: 'm',
  label: 'One\nTwo\nThree\nFour',
  ...patch,
});

describe('mind label geometry', () => {
  it('lays the label out at its size preset, and Auto at the px it is typed at', () => {
    expect(mindLabelFontPx(mind({ textSize: 'lg' }))).toBe(LABEL_FONT_PX.lg);
    expect(mindLabelFontPx(mind({ textSize: undefined }))).toBe(LABEL_FONT_PX.scale);
  });

  it("pads by the node's own padding, else a shape's default", () => {
    expect(mindLabelPadding(mind({ padding: 'lg' }))).toBe(PADDING_PX.lg);
    expect(mindLabelPadding(mind({ padding: undefined }))).toBe(PADDING_PX.sm);
  });

  it('measures at the width inside the padding, and adds the padding back, rounded up', () => {
    const measure = vi.fn(() => ({ width: 10, height: 100.4 }));
    const el = mind({ width: 250, padding: 'sm' });
    const pad = PADDING_PX.sm;
    expect(mindLabelHeight(el, measure)).toBe(101 + 2 * pad);
    expect(measure).toHaveBeenCalledWith(250 - 2 * pad, true);
  });
});

describe('fitMindLabel', () => {
  it('grows the node when its lines need more room', () => {
    const els: Element[] = [mind()];
    const next = fitMindLabel(els, 'm', () => () => ({ width: 1, height: 150 }));
    expect((next[0] as ShapeElement).height).toBe(150 + 2 * PADDING_PX.sm);
  });

  it('leaves a node whose label fits, and anything that is not a mind node', () => {
    const els: Element[] = [mind(), { ...createShape('square', 0, 0), id: 's' }];
    expect(fitMindLabel(els, 'm', () => () => ({ width: 1, height: 20 }))).toBe(els);
    expect(fitMindLabel(els, 's', () => () => ({ width: 1, height: 900 }))).toBe(els);
  });
});
