import { describe, expect, it } from 'vitest';
import {
  createArrow,
  createShape,
  createSticky,
  createTable,
  createText,
  DEFAULT_BACKGROUND_COLOR,
  penColourHex,
  type Element,
  type TableElement,
} from '@livediagram/document';
import { cellContrastProbes, textContrastProbe, textContrastProbes } from './text-contrast-probe';

// docs/specs/004-interface-design/colour-picker.md "Reading on its ground": a diagram's texts read on its canvas,
// as saved.
const tabOf = (elements: Element[], backgroundColor?: string) => ({
  elements,
  ...(backgroundColor ? { backgroundColor } : {}),
});
const text = (extra: object = {}) =>
  ({ ...createText(40, 40), id: 't', width: 120, height: 30, label: 'Hi', ...extra }) as Element;

describe('textContrastProbe', () => {
  it('reads text with nothing under it on the canvas paper, in its own colour', () => {
    const t = text({ textColor: '#FDE047' });
    const probe = textContrastProbe(t, tabOf([t]), 'light')!;
    expect(probe.ground).toEqual({ tones: [DEFAULT_BACKGROUND_COLOR], on: 'canvas' });
    expect(probe.current).toBe('#fde047');
    expect(probe.exported).toBe(false);
  });

  it('reads the canvas colour the tab saves, and stock colours in its version', () => {
    const t = text({ penTextColour: 'blue' });
    const probe = textContrastProbe(t, tabOf([t], '#0F172A'), 'dark')!;
    expect(probe.ground).toEqual({ tones: ['#0f172a'], on: 'canvas' });
    expect(probe.current).toBe(penColourHex('blue', 'dark'));
    expect(probe.colourOf('ink')).toBe(penColourHex('ink', 'dark'));
  });

  it('judges the canvas as saved when it is seen in the other appearance', () => {
    const t = text();
    expect(textContrastProbe(t, tabOf([t]), 'dark')!.exported).toBe(true);
    expect(textContrastProbe(t, tabOf([t], '#0f172a'), 'light')!.exported).toBe(true);
    expect(textContrastProbe(t, tabOf([t], '#0f172a'), 'dark')!.exported).toBe(false);
  });

  it('reads a shape on its fill, a sticky note on its paper, and text on a box under it', () => {
    const s = { ...createShape('square', 0, 0), id: 's', fillColor: '#1e293b' } as Element;
    expect(textContrastProbe(s, tabOf([s]), 'light')!.ground).toEqual({
      tones: ['#1e293b'],
      on: 'shape',
    });
    const note = { ...createSticky(0, 0), id: 'n', fillColor: '#fef08a' } as Element;
    expect(textContrastProbe(note, tabOf([note]), 'light')!.ground.on).toBe('shape');
    const big = { ...s, width: 400, height: 400 } as Element;
    const t = text();
    expect(textContrastProbe(t, tabOf([big, t]), 'light')!.ground).toEqual({
      tones: ['#1e293b'],
      on: 'card',
    });
  });

  it('judges nothing for an arrow or a canvas colour it cannot read', () => {
    const arrow = { ...createArrow(0, 0, 10, 10), id: 'a' } as Element;
    expect(textContrastProbe(arrow, tabOf([arrow]), 'light')).toBeNull();
    const t = text();
    expect(textContrastProbe(t, tabOf([t], 'not-a-colour'), 'light')).toBeNull();
    expect(textContrastProbes([t], tabOf([t], 'not-a-colour'), 'light')).toBeUndefined();
  });
});

describe('cellContrastProbes', () => {
  it('reads selected cells on their backgrounds and the canvas', () => {
    const table = {
      ...createTable(0, 0),
      id: 'tbl',
      cellStyles: [[{ bg: '#1e293b', textColor: '#334155' }]],
    } as TableElement;
    const probes = cellContrastProbes(
      table,
      [
        { r: 0, c: 0 },
        { r: 1, c: 1 },
      ],
      tabOf([table]),
      'light',
    )!;
    expect(probes[0]).toMatchObject({ current: '#334155', ground: { tones: ['#1e293b'] } });
    expect(probes.at(-1)!.ground.tones).toHaveLength(1);
  });
});
