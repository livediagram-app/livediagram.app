// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LABEL_FONT_PX, createShape, type ShapeElement } from '@livediagram/document';
import { measureDrawnMindLabel } from './text-hug-measure';

// This editor's binding of the shared hug measurer: a mind node's label measure. The measurer itself is tested in
// the workbench (components/label-editor/text-hug-measure.test.ts). jsdom lays nothing out, so these pin what the
// measurer lays in and how it is sized.
const measurer = () => document.querySelector<HTMLElement>('[data-text-hug-measurer]')!;

function stubRect(width: number, height: number) {
  return vi
    .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
    .mockReturnValue({ width, height } as DOMRect);
}

afterEach(() => vi.restoreAllMocks());

// docs/specs/009-elements/mind-node.md "A node grows to fit its label".
describe('measureDrawnMindLabel', () => {
  const mind = (patch: Partial<ShapeElement> = {}): ShapeElement => ({
    ...createShape('mind-node', 0, 0),
    label: 'Venue\nBudget',
    ...patch,
  });

  it('lays the label in at its size preset, its lines kept, at a fixed width', () => {
    stubRect(200, 55);
    const size = measureDrawnMindLabel(undefined)(mind({ textSize: 'md' }))(234, true);
    expect(size).toEqual({ width: 200, height: 55 });
    const node = measurer();
    expect(node.style.fontSize).toBe(`${LABEL_FONT_PX.md}px`);
    expect(node.style.width).toBe('234px');
    expect(node.textContent).toBe('Venue\nBudget');
  });

  it('measures an Auto node at the px it is typed at', () => {
    stubRect(1, 1);
    measureDrawnMindLabel(undefined)(mind({ textSize: undefined }))(234, true);
    expect(measurer().style.fontSize).toBe(`${LABEL_FONT_PX.scale}px`);
  });
});
