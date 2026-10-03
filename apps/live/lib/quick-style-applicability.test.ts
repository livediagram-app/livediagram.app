import { describe, expect, it } from 'vitest';
import {
  THEMES,
  createFreehand,
  createPath,
  createShape,
  type Element,
} from '@livediagram/document';
import { quickStyleApplicability, quickStyleCaption } from './quick-style-applicability';
import { applyQuickFill, applyQuickStroke, applyQuickWidth, quickStyleView } from './quick-style';
import { applyPenStyle, strokesPenStyle } from './quick-style-pen';

// docs/specs/008-canvas/quick-style-panel.md "Multi-selection": any mix of kinds, as a whole
// imported board selects. Each row styles what it fits, everything else is passed over.
const theme = THEMES.find((t) => t.id === 'brand')!;
const pen = (id: string) =>
  ({
    ...createFreehand(
      [
        { x: 0, y: 0 },
        { x: 9, y: 9 },
      ],
      false,
    ),
    id,
    penWidth: 1.5,
  }) as Element;
const mixed: Element[] = [
  pen('stroke-1'),
  pen('stroke-2'),
  { ...createShape('square', 0, 0), id: 'shape' },
  { id: 'text', type: 'text', x: 0, y: 0, width: 9, height: 9, label: 'Hi' } as Element,
  {
    id: 'arrow',
    type: 'arrow',
    from: { kind: 'free', x: 0, y: 0 },
    to: { kind: 'free', x: 9, y: 9 },
  } as Element,
  {
    ...createPath(
      [
        { x: 0, y: 0, mode: 'corner' },
        { x: 9, y: 0, mode: 'corner' },
        { x: 9, y: 9, mode: 'corner' },
      ],
      true,
    ),
    id: 'path',
  },
  { id: 'sticky', type: 'sticky', x: 0, y: 0, width: 9, height: 9 } as Element,
  { id: 'image', type: 'image', x: 0, y: 0, width: 9, height: 9, imageId: null } as Element,
  { ...createShape('frame', 0, 0), id: 'frame' },
  { ...createShape('square', 0, 0), id: 'locked', locked: true },
];

describe('quickStyleApplicability', () => {
  it('splits a mixed selection into what the rows style and what they pass over', () => {
    const a = quickStyleApplicability(mixed);
    expect(a.strokes.map((e) => e.id)).toEqual(['stroke-1', 'stroke-2']);
    expect(a.targets.map((e) => e.id)).toEqual(['shape', 'text', 'arrow', 'path', 'frame']);
  });
});

const WIDE = ['shape', 'arrow', 'path', 'frame'];

describe('a mixed selection', () => {
  it('shows every row some element takes, and the marker rows for the strokes', () => {
    const view = quickStyleView(mixed, theme)!;
    expect(Object.keys(view.sections).sort()).toEqual(
      ['background', 'stroke', 'style', 'textAlign', 'textColour', 'width'].sort(),
    );
    expect(
      strokesPenStyle(mixed, { board: 'light', ink: '#000', custom: [] })!.subject,
    ).toMatchObject({
      ids: ['stroke-1', 'stroke-2'],
    });
  });

  it('applies each row only to the elements it fits', () => {
    const stroked = mixed.map((el) => applyQuickStroke(el, theme, 2));
    const changed = mixed.filter((el, i) => stroked[i] !== el).map((el) => el.id);
    // A frame draws its border, so the Stroke row takes it too.
    expect(changed).toEqual(['shape', 'arrow', 'path', 'frame']);
    const filled = mixed.map((el) => applyQuickFill(el, theme, 2));
    expect(mixed.filter((el, i) => filled[i] !== el).map((el) => el.id)).toEqual([
      'shape',
      'path',
      'frame',
    ]);
    const wide = mixed.map((el) => applyQuickWidth(el, 'thick'));
    expect(mixed.filter((el, i) => wide[i] !== el).map((el) => el.id)).toEqual(WIDE);
    const marked = mixed.map((el) => applyPenStyle(el, { colour: 'red' }));
    expect(mixed.filter((el, i) => marked[i] !== el).map((el) => el.id)).toEqual([
      'stroke-1',
      'stroke-2',
    ]);
  });

  it('marks no value where the elements a row fits disagree', () => {
    const els = mixed.map((el) =>
      el.id === 'shape'
        ? applyQuickStroke(el, theme, 3)
        : el.id === 'arrow'
          ? applyQuickStroke(el, theme, 4)
          : el,
    );
    expect(quickStyleView(els, theme)!.sections.stroke!.value).toBeNull();
  });
});

describe('quickStyleCaption', () => {
  it('names strokes alone, counts a mix, and stays out of a selection without strokes', () => {
    const only = quickStyleApplicability([pen('a'), pen('b'), pen('c')]);
    expect(quickStyleCaption(only)).toBe('3 marker strokes');
    expect(quickStyleCaption(quickStyleApplicability([pen('a')]))).toBe('Marker stroke');
    // Passed-over kinds (sticky, image, a locked shape) are not counted.
    expect(quickStyleCaption(quickStyleApplicability(mixed))).toBe('7 elements');
    expect(quickStyleCaption(quickStyleApplicability([mixed[2]!, mixed[3]!]))).toBeUndefined();
    expect(quickStyleCaption(quickStyleApplicability([mixed[6]!]))).toBeUndefined();
  });
});
