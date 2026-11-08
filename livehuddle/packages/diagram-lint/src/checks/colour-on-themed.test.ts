import { describe, expect, it } from 'vitest';
import type { Element } from '@livehuddle/document';
import { arrow, box, lint, of, tabOf } from '../fixtures/build';

const themed = (theme: string | undefined, ...elements: Element[]) => ({
  ...tabOf(...elements),
  theme,
});

describe('colour-on-themed', () => {
  it('fires on a hex fill or stroke the theme would not paint, bound to nothing', () => {
    const report = lint(
      themed(
        'ocean',
        box('a', 0, 0, { fillColor: '#123456' }),
        box('b', 300, 0, { fillColor: '#123456', strokeColor: '#654321' }),
      ),
    );
    expect(of(report, 'colour-on-themed').map((f) => [f.message, f.fix])).toEqual([
      ['a sets its fill on a themed tab', 'set a fill='],
      ['b sets its fill and stroke on a themed tab', 'set b fill= stroke='],
    ]);
  });

  // A stored arrow is a retired element with no theme colour fields (part 4 of the element engine).
  it('leaves a stored arrow’s stroke alone', () => {
    const report = lint(
      themed(
        undefined,
        box('a', 0, 0),
        box('b', 300, 0),
        arrow('x', 'a', 'b', ['e', 'w'], { strokeColor: '#ff00ff' }),
      ),
    );
    expect(of(report, 'colour-on-themed')).toEqual([]);
  });

  it('leaves theme colours, presets, swatches, marker names and stickies alone', () => {
    const quiet = [
      box('preset', 0, 0, { fillColor: '#123456', colorPreset: 'red' }),
      box('swatch', 300, 0, { fillColor: '#123456', fillSwatch: 2 }),
      box('marker', 600, 0, { strokeColor: 'pen-red' }),
      { ...box('sticky', 900, 0, { fillColor: '#123456' }), type: 'sticky' } as Element,
      box('none', 1200, 0),
    ];
    expect(of(lint(themed('ocean', ...quiet)), 'colour-on-themed')).toEqual([]);
  });

  it('accepts the colours a multi-colour, per-shape and Default theme paint, as well as type defaults', async () => {
    const { THEMES } = await import('@livehuddle/document');
    for (const theme of THEMES) {
      const colours = [
        theme.elementFill,
        ...(theme.palette ?? []).map((p) => p.fill),
        ...Object.values(theme.shapeColors ?? {}).map((o) => o?.fill),
      ].filter((c): c is string => typeof c === 'string');
      const els = colours.map((fill, i) =>
        box(`b${i}`, i * 200, 0, { fillColor: fill.toUpperCase() }),
      );
      expect(of(lint(themed(theme.id, ...els)), 'colour-on-themed')).toEqual([]);
    }
  });

  it('accepts the type default the Default theme leaves an element, on either surface', async () => {
    const { defaultFillColor, defaultStrokeColor } = await import('@livehuddle/document');
    const plain = box('a', 0, 0) as never;
    const els = [
      box('a', 0, 0, {
        fillColor: defaultFillColor(plain),
        strokeColor: defaultStrokeColor(plain, 'dark'),
      }),
    ];
    expect(of(lint(themed(undefined, ...els)), 'colour-on-themed')).toEqual([]);
    expect(
      of(lint(themed('brand', box('b', 0, 0, { strokeColor: '#123456' }))), 'colour-on-themed'),
    ).toHaveLength(1);
  });

  it('skips an unknown theme and logs it (N15)', () => {
    const logged: string[] = [];
    const report = lint(themed('unknown-theme', box('a', 0, 0, { fillColor: '#123456' })), {
      log: (fp) => logged.push(fp),
    });
    expect(of(report, 'colour-on-themed')).toEqual([]);
    expect(logged).toContain('[lint] theme unresolved');
  });

  it('passes a fill locked against the theme, still reporting its stroke', () => {
    const locked = box('a', 0, 0, {
      fillColor: '#123456',
      strokeColor: '#654321',
      themeLockFill: true,
    });
    const found = of(lint({ ...tabOf(locked), theme: 'ocean' }), 'colour-on-themed');
    expect(found.map((f) => f.message)).toEqual([
      expect.stringMatching(/sets its stroke on a themed tab$/),
    ]);
  });
});

describe('colour-on-themed, judged on what set the colour', () => {
  const coloured = (id: string, x: number, extra: Record<string, unknown> = {}) =>
    box(id, x, 0, { fillColor: '#123456', ...extra });

  it('names only the elements a write coloured, when told which', () => {
    const tab = themed('ocean', coloured('a', 0), coloured('b', 300));
    const named = (coloured?: ReadonlySet<string>) =>
      of(lint(tab, coloured ? { coloured } : {}), 'colour-on-themed').map((f) => f.refs[0]);
    expect(named()).toEqual(['a', 'b']);
    expect(named(new Set(['b']))).toEqual(['b']);
    expect(named(new Set())).toEqual([]);
  });

  it('leaves a fill locked against the theme alone', () => {
    const report = lint(
      themed(
        'ocean',
        coloured('l', 300, { themeLockFill: true }),
        coloured('k', 600, { themeLockFill: true, strokeColor: '#654321' }),
        coloured('u', 900, { themeLockFill: false }),
      ),
    );
    expect(of(report, 'colour-on-themed').map((f) => f.message)).toEqual([
      'k sets its stroke on a themed tab',
      'u sets its fill on a themed tab',
    ]);
  });
});
