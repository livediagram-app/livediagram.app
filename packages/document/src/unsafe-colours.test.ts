import { describe, expect, it, vi } from 'vitest';
import { migrateStoredElements } from './stored-elements';
import { dropUnsafeColours, isSafeColourValue } from './unsafe-colours';
import type { Element } from './index';

// A colour that could load something from outside the document never reaches the canvas (unsafe-colours.ts).
describe('dropUnsafeColours', () => {
  it('keeps every colour CSS writes', () => {
    for (const c of [
      '#abc',
      '#aabbccdd',
      'red',
      'transparent',
      'currentColor',
      'rgb(1, 2, 3)',
      'hsl(10 20% 30% / 0.5)',
      'oklch(0.7 0.1 200)',
      'color-mix(in srgb, red 20%, transparent)',
      'var(--ink)',
    ])
      expect(isSafeColourValue(c), c).toBe(true);
  });

  it('refuses a value that loads something or leaves its CSS value', () => {
    for (const c of [
      'url(https://example.com/x)',
      'red 1%,red),url(//e.example/x),linear-gradient(red',
      'URL(x)',
      'u\\72l(x)',
      'image-set("x" 1x)',
      '-webkit-image-set(x)',
      'red; background: blue',
      'element(#x)',
      'cross-fade(a, b)',
      'paint(worklet)',
    ])
      expect(isSafeColourValue(c), c).toBe(false);
  });

  it('drops an unsafe colour on an element and on its rows, and leaves the rest', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const el = {
      id: 'a',
      type: 'shape',
      shape: 'rect',
      x: 0,
      y: 0,
      width: 10,
      height: 10,
      label: 'url(not a colour field)',
      fillColor: '#fff',
      textColor: 'red 1%,red),url(//e.example/x),linear-gradient(red',
      chartSeries: [{ name: 'S', color: 'url(//e.example/y)', values: [1, 2] }],
    } as unknown as Element;
    const [clean] = dropUnsafeColours([el]) as unknown as Record<string, unknown>[];
    expect(clean).not.toHaveProperty('textColor');
    expect(clean!.fillColor).toBe('#fff');
    expect(clean!.label).toBe('url(not a colour field)');
    expect((clean!.chartSeries as Record<string, unknown>[])[0]).toEqual({
      name: 'S',
      values: [1, 2],
    });
  });

  it('hands back the same list when nothing needed dropping, and runs with the stored-element migrations', () => {
    const els = [
      {
        id: 'a',
        type: 'shape',
        shape: 'rect',
        x: 0,
        y: 0,
        width: 10,
        height: 10,
        fillColor: '#fff',
      },
      {
        id: 'f',
        type: 'freehand',
        x: 0,
        y: 0,
        width: 1,
        height: 1,
        points: [
          [0, 0],
          [1, 1],
        ],
      },
    ] as unknown as Element[];
    expect(dropUnsafeColours(els)).toBe(els);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const migrated = migrateStoredElements([{ ...els[0]!, strokeColor: 'url(x)' }]);
    expect(migrated[0]).not.toHaveProperty('strokeColor');
  });

  it('drops a colour field that is not a string, and keeps a page background fill object', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const el = {
      id: 'a',
      type: 'shape',
      shape: 'page',
      x: 0,
      y: 0,
      width: 10,
      height: 10,
      fillColor: 7,
      strokeColor: { a: 1 },
      textColor: null,
      background: { fill: { kind: 'solid', color: '#fff' } },
    } as unknown as Element;
    const [clean] = dropUnsafeColours([el]) as unknown as Record<string, unknown>[];
    expect(clean).not.toHaveProperty('fillColor');
    expect(clean).not.toHaveProperty('strokeColor');
    expect(clean!.textColor).toBeNull();
    expect(clean!.background).toEqual({ fill: { kind: 'solid', color: '#fff' } });
  });
});
