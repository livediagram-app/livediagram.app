import { describe, expect, it } from 'vitest';
import type { ArrowLabelLayout } from '@livediagram/diagram';
import { sameLabelRender, type ArrowLabelRender } from './useArrowLabelLayouts';

const layout = (over: Partial<ArrowLabelLayout> = {}): ArrowLabelLayout => ({
  mode: 'on-line',
  center: { x: 100, y: 50 },
  lines: ['Use personal', 'assistant'],
  fontPx: 12,
  lineHeightPx: 15,
  width: 80,
  height: 34,
  knockout: { x: 57, y: 30, width: 86, height: 40 },
  ...over,
});

const render = (l: ArrowLabelLayout | null, knockouts = l?.knockout ? [l.knockout] : []) =>
  ({ layout: l, knockouts }) satisfies ArrowLabelRender;

describe('sameLabelRender', () => {
  it('treats a freshly computed equal layout as the same', () => {
    expect(sameLabelRender(render(layout()), render(layout()))).toBe(true);
  });

  it('sees a moved label', () => {
    expect(sameLabelRender(render(layout()), render(layout({ center: { x: 101, y: 50 } })))).toBe(
      false,
    );
  });

  it('sees a re-wrapped label', () => {
    expect(
      sameLabelRender(render(layout()), render(layout({ lines: ['Use', 'personal assistant'] }))),
    ).toBe(false);
  });

  it('sees a changed knockout set', () => {
    const extra = { x: 0, y: 0, width: 1, height: 1 };
    const l = layout();
    expect(sameLabelRender(render(l), render(l, [l.knockout!, extra]))).toBe(false);
  });

  it('treats two unlabelled arrows as the same', () => {
    expect(sameLabelRender(render(null), render(null))).toBe(true);
  });

  it('sees a label appear', () => {
    expect(sameLabelRender(render(null), render(layout()))).toBe(false);
  });
});
