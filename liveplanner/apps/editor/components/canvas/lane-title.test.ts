// A lane's title on the canvas (docs/specs/009-elements/lane.md "A title wraps in its gutter", "Upright titles"; Work
// Tracker 877): laid out in its gutter as the export lays it out.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { resetLabelMeasureContext } from '@liveworkspace/element-model/svg-render-primitives';
import { standInBrowser } from '@liveworkspace/element-model/testing/font-stand-in';
import { clearLaneTitleCache } from '@liveworkspace/workbench/components/canvas/lane-title-frame';
import {
  createShape,
  renderElementsToSvg,
  type BoxedElement,
  type ShapeElement,
  type Tab,
} from '@liveplanner/project';
import { laneTitleOf } from './lane-title';

const LONG = 'Quarterly marketing programme review and sign off with every regional lead';

const lane = (extra: Partial<ShapeElement> = {}): ShapeElement => ({
  ...createShape('lane', 0, 0),
  id: 'l1',
  label: LONG,
  textSize: 'md',
  textAlignX: 'left',
  textAlignY: 'middle',
  ...extra,
});

const of = (el: BoxedElement, editing = false) =>
  laneTitleOf(
    el,
    (el as { label?: string }).label ?? '',
    (el as { textSize?: ShapeElement['textSize'] }).textSize ?? 'scale',
    (el as { textAlignX?: 'left' }).textAlignX ?? 'left',
    (el as { textAlignY?: 'middle' }).textAlignY ?? 'middle',
    editing,
    undefined,
  );

const tab = (elements: ShapeElement[]) => ({ id: 't', name: 'T', elements }) as unknown as Tab;

describe('laneTitleOf', () => {
  it('leaves any other element as it is', () => {
    const square = { ...createShape('square', 0, 0), id: 's', label: LONG } as ShapeElement;
    const title = of(square);
    expect(title.frame).toBeNull();
    expect(title.label).toBe(LONG);
    expect(title.textSize).toBe(square.textSize ?? 'scale');
  });

  it('lays an across title out in its gutter in whole words, three lines at most, with the small padding', () => {
    const title = of(lane());
    expect(title.frame?.style).toMatchObject({ left: 0, top: 0, width: 132, overflow: 'hidden' });
    expect(title.frame?.className).toBe('[&>div>div]:whitespace-pre');
    const lines = title.label.split('\n');
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.length).toBeLessThanOrEqual(3);
    expect(lines[lines.length - 1]).toMatch(/…$/);
    expect(title.padding).toBe(6);
  });

  it('draws the same lines the export draws', () => {
    const el = lane();
    const svg = renderElementsToSvg(tab([el]));
    const exported = [...svg.matchAll(/<tspan[^>]*>([^<]*)<\/tspan>/g)].map((m) => m[1]!);
    expect(of(el).label.split('\n')).toEqual(exported);
  });

  it('follows the gutter to the right', () => {
    const title = of(lane({ textAlignX: 'right' }));
    expect(title.frame?.style).toMatchObject({ left: 900 - 132, width: 132 });
  });

  it('steps a word too wide for the gutter down to a px size', () => {
    const title = of(lane({ label: 'Internationalisation', textSize: 'lg' }));
    expect(typeof title.textSize).toBe('number');
  });

  it('lets the editor hang from the strip, the words as typed', () => {
    const title = of(lane(), true);
    expect(title.label).toBe(LONG);
    expect(title.alignY).toBe('top');
    expect(title.frame?.style.overflow).toBe('visible');
  });

  it('clamps a formatted title by CSS, and a fitted-size one is laid out only at a set size', () => {
    const formatted = of(
      lane({ richText: [{ text: 'Quarterly', bold: true }, { text: ' plan' }] }),
    );
    expect(formatted.label).toBe(LONG);
    expect(formatted.frame?.className).toContain('line-clamp-3');
    expect(of(lane({ textSize: 'scale' })).label).toBe(LONG);
  });

  it('turns an upright title in its strip, reading along it', () => {
    const title = of(lane({ titleOrientation: 'upright', textAlignY: 'top' }));
    expect(title.frame?.style).toMatchObject({ transform: 'rotate(-90deg)' });
    expect(title.alignX).toBe('right');
    expect(title.alignY).toBe('middle');
    expect(title.padding).toBeLessThanOrEqual(6);
    expect(title.label).toBe(LONG);
  });

  it('gives a band across the top the whole lane', () => {
    const title = of(lane({ textAlignX: 'center', textAlignY: 'top' }));
    expect(title.frame).toBeNull();
    expect(title.label).toBe(LONG);
  });
});

// Work Tracker 910: the canvas and the export measure a lane title with one measure (laneTitleMeasure, weight 500, the
// 1 px reserve), so a word too long for the gutter even at the small size is cut at the same letter in each. Measured
// with a real-font stand-in, whose widths follow the weight, since the estimate alone hid the difference.
describe('a word too long for the gutter, measured with a real font', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    resetLabelMeasureContext();
    clearLaneTitleCache();
  });

  it('is cut at the same letter on the canvas and in the export', () => {
    const stand = standInBrowser();
    vi.stubGlobal('document', stand.document);
    vi.stubGlobal('getComputedStyle', stand.getComputedStyle);
    resetLabelMeasureContext();
    clearLaneTitleCache();
    for (const label of [
      'Supercalifragilisticexpialidocious',
      'Internationalisation Wonderworks',
    ]) {
      const el = lane({ label, textSize: 'lg' });
      const canvas = of(el).label.split('\n');
      const svg = renderElementsToSvg(tab([el]));
      const exported = [...svg.matchAll(/<tspan[^>]*>([^<]*)<\/tspan>/g)].map((m) => m[1]!);
      expect(canvas).toEqual(exported);
      expect(canvas.some((line) => line.endsWith('…'))).toBe(true);
    }
  });
});
