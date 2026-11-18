import { describe, expect, it } from 'vitest';
import {
  createArrow,
  createShape,
  createText,
  layOutPages,
  penColourHex,
  type Element,
  type Page,
  type PageFill,
} from '@livedocuments/document';
import { textContrastProbe, textContrastProbes } from './text-contrast-probe';

// docs/specs/004-interface-design/colour-picker.md "Reading on its ground".
const PAGE = { id: 'p', orientation: 'portrait' } as const;
const rect = layOutPages([PAGE])[0]!.rect;
const tabOf = (elements: Element[], fill?: PageFill) => ({
  elements,
  pages: [{ ...PAGE, ...(fill ? { background: { fill } } : {}) }] as Page[],
});
const text = (extra: object = {}) =>
  ({
    ...createText(rect.x + 40, rect.y + 40),
    id: 't',
    width: 120,
    height: 30,
    label: 'Hi',
    ...extra,
  }) as Element;

describe('textContrastProbe', () => {
  it('reads a colour of its own as it is', () => {
    const t = text({ textColor: '#FDE047' });
    const probe = textContrastProbe(t, tabOf([t]), 'light')!;
    expect(probe.ground).toEqual({ tones: ['#ffffff'], on: 'page' });
    expect(probe.current).toBe('#fde047');
  });

  it('reads a stock colour, and every stock swatch, in its version for the ground', () => {
    const t = text({ penTextColour: 'blue' });
    const dark = tabOf([t], { kind: 'solid', color: '#0f172a' });
    const probe = textContrastProbe(t, dark, 'light')!;
    expect(probe.current).toBe(penColourHex('blue', 'dark'));
    expect(probe.colourOf('ink')).toBe(penColourHex('ink', 'dark'));
    expect(probe.colourOf('#ABCDEF')).toBe('#abcdef');
    expect(probe.colourOf('transparent')).toBeNull();
  });

  it('reads text with no colour of its own in its default ink', () => {
    const t = text();
    expect(textContrastProbe(t, tabOf([t]), 'light')!.current).toBe(penColourHex('ink', 'light'));
  });

  it('marks large text from its drawn size', () => {
    const big = text({ textSize: 32 });
    const small = text({ textSize: 14 });
    expect(textContrastProbe(big, tabOf([big]), 'light')!.large).toBe(true);
    expect(textContrastProbe(small, tabOf([small]), 'light')!.large).toBe(false);
  });

  it('judges nothing on a picture, off the pages, or for an arrow', () => {
    const t = text();
    const picture = { kind: 'image', imageId: 'img-1' } as PageFill;
    expect(textContrastProbe(t, tabOf([t], picture), 'light')).toBeNull();
    const away = text({ x: rect.x - 9000 });
    expect(textContrastProbe(away, tabOf([away]), 'light')).toBeNull();
    const arrow = { ...createArrow(0, 0, 10, 10), id: 'a' } as Element;
    expect(textContrastProbe(arrow, tabOf([arrow]), 'light')).toBeNull();
  });

  it('reads a filled shape on its fill', () => {
    const s = {
      ...createShape('square', rect.x + 10, rect.y + 10),
      id: 's',
      fillColor: '#1e293b',
    } as Element;
    expect(textContrastProbe(s, tabOf([s]), 'light')!.ground.on).toBe('shape');
  });

  it('judges a page ground as exported on a dark canvas, never a fill', () => {
    const t = text();
    expect(textContrastProbe(t, tabOf([t]), 'dark')!.exported).toBe(true);
    expect(textContrastProbe(t, tabOf([t]), 'light')!.exported).toBe(false);
    const s = {
      ...createShape('square', rect.x + 10, rect.y + 10),
      id: 's',
      fillColor: '#1e293b',
    } as Element;
    expect(textContrastProbe(s, tabOf([s]), 'dark')!.exported).toBe(false);
  });

  it('gives a probe for each element it can judge, or undefined for none', () => {
    const t = text();
    const away = text({ id: 'away', x: rect.x - 9000 });
    const tab = tabOf([t, away]);
    expect(textContrastProbes([t, away], tab, 'light')).toHaveLength(1);
    expect(textContrastProbes([away], tab, 'light')).toBeUndefined();
  });
});
