import { describe, expect, it } from 'vitest';
import {
  createText,
  layOutPages,
  newSlidePage,
  SLIDE_PAGE_SIZE_IDS,
  type Element,
  type LaidOutPage,
  type TextElement,
} from '@livedocuments/document';
import { fitLayoutText, labelOverflows } from './layout-text-fit';
import { buildPageLayout } from './page-layout-build';
import { PAGE_LAYOUTS } from './page-layouts';
import { SLIDE_LAYOUTS } from './slide-layouts';

// docs/specs/007-editor/pages-mode.md "Layouts", "Words fit their boxes" (Work Tracker 1481).
const row = (extra: Partial<TextElement> = {}): TextElement => ({
  ...createText(0, 0),
  width: 220,
  height: 43,
  label: 'A small marketing budget',
  textSize: 'md',
  ...extra,
});

const overflowing = (page: LaidOutPage, ids: readonly string[]) =>
  ids.flatMap((id) =>
    buildPageLayout(id as never, page)
      .filter(labelOverflows)
      .map((el: Element) => `${id}: ${JSON.stringify((el as TextElement).label).slice(0, 40)}`),
  );

describe('fitLayoutText', () => {
  it("steps a row's words down until their lines fit it: a SWOT point that wraps to two", () => {
    expect(labelOverflows(row())).toBe(true);
    const [fitted] = fitLayoutText([row()]) as TextElement[];
    expect(fitted!.textSize).toBe('sm');
    expect(labelOverflows(fitted!)).toBe(false);
  });

  it('steps a box too short for one line of its size: a scorecard label', () => {
    const [fitted] = fitLayoutText([row({ label: 'Value', height: 16 })]) as TextElement[];
    expect(fitted!.textSize).toBe('sm');
  });

  it("steps a list's rows together, so one long point never leaves the list in two sizes", () => {
    const sizes = fitLayoutText([row(), row({ label: 'Ask first', y: 50 })]).map(
      (el) => (el as TextElement).textSize,
    );
    expect(sizes).toEqual(['sm', 'sm']);
  });

  it('leaves words that fit, and a label set to scale or to a size of its own', () => {
    const fits = row({ height: 80 });
    const scale = row({ textSize: 'scale' });
    const own = row({ textSize: 30 });
    expect(fitLayoutText([fits, scale, own])).toEqual([fits, scale, own]);
  });
});

describe('every layout’s words fit their boxes as placed', () => {
  it('every infographic layout on an A4 page', () => {
    const [page] = layOutPages([
      { id: 'p', orientation: 'portrait', size: 'a4', kind: 'infographic' },
    ]);
    expect(
      overflowing(
        page!,
        PAGE_LAYOUTS.map((l) => l.id),
      ),
    ).toEqual([]);
  });

  it.each(SLIDE_PAGE_SIZE_IDS)('every slide layout on a %s slide', (size) => {
    const [page] = layOutPages([newSlidePage('s', size)]);
    expect(
      overflowing(
        page!,
        SLIDE_LAYOUTS.map((l) => l.id),
      ),
    ).toEqual([]);
  });
});
