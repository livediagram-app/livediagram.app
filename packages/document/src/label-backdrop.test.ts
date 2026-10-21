import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveplanner/vitest-config/cpu-time';
import { contrastRatio } from './colors';
import { LABEL_BACKDROP_CONTRAST, labelBackdrops, withReadableLabelInks } from './label-backdrop';
import type { Element } from './index';

// docs/specs/011-theme/light-and-dark.md "A theme never sinks a label into what is behind it".

const panel = (id: string, fillColor: string, x = 0, y = 0, w = 400, h = 300, opacity?: number) =>
  ({
    id,
    type: 'shape',
    shape: 'rectangle',
    x,
    y,
    width: w,
    height: h,
    fillColor,
    ...(opacity === undefined ? {} : { opacity }),
  }) as unknown as Element;
const label = (id: string, textColor: string | undefined, x = 100, y = 100) =>
  ({
    id,
    type: 'text',
    x,
    y,
    width: 120,
    height: 24,
    label: 'Words',
    ...(textColor ? { textColor } : {}),
  }) as unknown as Element;

const CANVAS = '#fbfaf7';

describe('labelBackdrops', () => {
  it('finds the panel a label sits on', () => {
    const b = labelBackdrops([panel('p', '#fde68a'), label('t', '#0f172a')], CANVAS);
    expect(b.get(1)).toEqual({ ink: '#0f172a', behind: '#fde68a' });
  });

  it('takes the topmost panel, and the canvas off every panel', () => {
    const els = [
      panel('a', '#fde68a'),
      panel('b', '#bbf7d0', 50, 50, 300, 200),
      label('t', '#0f172a'),
      label('off', '#0f172a', 2000, 2000),
    ];
    const b = labelBackdrops(els, CANVAS);
    expect(b.get(2)?.behind).toBe('#bbf7d0');
    expect(b.get(3)?.behind).toBe(CANVAS);
  });

  it('mixes a translucent panel over what is under it', () => {
    const b = labelBackdrops(
      [panel('p', '#000000', 0, 0, 400, 300, 0.5), label('t', '#ffffff')],
      '#ffffff',
    );
    expect(b.get(1)?.behind).toBe('#808080');
  });

  it('reads a shape’s own fill as its label’s backdrop, but not a panel painted after the label', () => {
    const box = {
      ...(panel('box', '#1e3a8a', 100, 100, 120, 60) as object),
      label: 'Box',
      textColor: '#ffffff',
    };
    const b = labelBackdrops(
      [box as unknown as Element, label('t', '#0f172a', 300, 250), panel('late', '#000000')],
      CANVAS,
    );
    expect(b.get(0)?.behind).toBe('#1e3a8a');
    expect(b.get(1)?.behind).toBe(CANVAS);
  });

  it('finds a panel far bigger than the lookup grid', () => {
    const huge = panel('huge', '#fde68a', -100_000, -100_000, 200_000, 200_000);
    const b = labelBackdrops([huge, label('t', '#0f172a', 50_000, 50_000)], CANVAS);
    expect(b.get(1)?.behind).toBe('#fde68a');
  });
});

describe('withReadableLabelInks', () => {
  it('re-inks a label a theme sank into the panel under it', () => {
    const before = [panel('p', '#fde68a'), label('t', '#0f172a')];
    // The theme repainted the panel deep brown and left the label's dark ink.
    const after = [panel('p', '#563b1e'), label('t', '#0f172a')];
    const out = withReadableLabelInks(before, CANVAS, after, '#1a1a1a');
    const ink = (out[1] as unknown as { textColor: string }).textColor;
    expect(contrastRatio(ink, '#563b1e')).toBeGreaterThanOrEqual(LABEL_BACKDROP_CONTRAST);
    expect(out[0]).toBe(after[0]);
  });

  it('re-inks a label on a canvas the half turned dark', () => {
    const before = [label('t', '#64748b')];
    const out = withReadableLabelInks(before, '#ffffff', before, '#0d121a');
    expect(
      contrastRatio((out[0] as unknown as { textColor: string }).textColor, '#0d121a'),
    ).toBeGreaterThanOrEqual(LABEL_BACKDROP_CONTRAST);
  });

  it('walks a rich label’s coloured runs the panel under it sank, and leaves its plain runs', () => {
    const rich = (runs: { text: string; color?: string }[]) =>
      ({ ...(label('t', '#ffffff') as object), richText: runs }) as unknown as Element;
    const runs = [{ text: 'measured by', color: '#059669' }, { text: ', plain' }];
    const before = [panel('p', '#0f172a'), rich(runs)];
    // A green panel under green words.
    const after = [panel('p', '#1f6f43'), rich(runs)];
    const out = withReadableLabelInks(before, CANVAS, after, CANVAS)[1] as unknown as {
      richText: { text: string; color?: string }[];
    };
    expect(contrastRatio(out.richText[0]!.color!, '#1f6f43')).toBeGreaterThanOrEqual(
      LABEL_BACKDROP_CONTRAST,
    );
    expect(out.richText[1]).toBe(runs[1]);
  });

  it('keeps a label someone chose low, which no theme sank', () => {
    const els = [panel('p', '#ffffff'), label('t', '#fde68a')];
    expect(withReadableLabelInks(els, CANVAS, els, CANVAS)).toBe(els);
  });

  it('is the same array when every label reads', () => {
    const els = [panel('p', '#fde68a'), label('t', '#0f172a')];
    expect(withReadableLabelInks(els, CANVAS, els, '#0d121a')).toBe(els);
  });

  it('falls back to black or white where the hue cannot reach the floor', () => {
    // Pure yellow, read on a dark panel, on the mid grey it became: its walked lightness tops out short of 3:1.
    const before = [panel('p', '#333333'), label('t', '#ffff00')];
    const after = [panel('p', '#bbbbbb'), label('t', '#ffff00')];
    const ink = (
      withReadableLabelInks(before, CANVAS, after, CANVAS)[1] as unknown as {
        textColor: string;
      }
    ).textColor;
    expect(contrastRatio(ink, '#bbbbbb')).toBeGreaterThanOrEqual(LABEL_BACKDROP_CONTRAST);
  });

  // The canvas runs this on every edit of a tab drawn in the other half: 5,000 elements (a thousand panels, four
  // thousand labels, every label sunk) must stay well inside a frame budget.
  it('re-inks a 5,000-element tab quickly', () => {
    const before: Element[] = [];
    const after: Element[] = [];
    for (let i = 0; i < 1000; i++) {
      const x = (i % 40) * 450;
      const y = Math.floor(i / 40) * 350;
      before.push(panel(`p${i}`, '#fde68a', x, y));
      after.push(panel(`p${i}`, '#563b1e', x, y));
      for (let k = 0; k < 4; k++) {
        const t = label(`t${i}-${k}`, '#0f172a', x + 20 + k * 60, y + 40 + k * 50);
        before.push(t);
        after.push(t);
      }
    }
    expect(withReadableLabelInks(before, CANVAS, after, '#1a1a1a')).not.toBe(after);
    // About 9 ms warm on an idle machine; CPU time, so a busy machine does not fail it.
    const ms = cpuMsOf(() => withReadableLabelInks(before, CANVAS, after, '#1a1a1a'));
    expect(ms).toBeLessThan(cpuBudgetMs(100));
  });
});
