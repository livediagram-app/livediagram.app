import { describe, expect, it } from 'vitest';
import { LABEL_BACKDROP_CONTRAST, labelInks, type LabelInkColours } from './label-backdrop';

// A minimal product binding: WCAG luminance, grey defaults, and a walk that steps toward white or black.
const lum = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
};
const contrastRatio = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};
type El = { id: string; type: string; [k: string]: unknown };
const colours: LabelInkColours<El> = {
  canvasSurface: (c) => (lum(c) > 0.18 ? 'light' : 'dark'),
  contrastRatio,
  defaultFillColor: (_el, s) => (s === 'light' ? '#ffffff' : '#1e293b'),
  defaultTextColor: (_el, s) => (s === 'light' ? '#0f172a' : '#f1f5f9'),
  // Too far for any walk to help: the factory then falls back to black or white, whichever reads.
  reachContrast: (fg) => fg,
};
const { labelBackdrops, withReadableLabelInks } = labelInks(colours);

const text = (id: string, over: Record<string, unknown> = {}): El => ({
  id,
  type: 'text',
  x: 0,
  y: 0,
  width: 100,
  height: 20,
  label: 'Words',
  textColor: '#0f172a',
  ...over,
});
const panel = (id: string, fillColor: string, over: Record<string, unknown> = {}): El => ({
  id,
  type: 'shape',
  shape: 'square',
  x: -100,
  y: -100,
  width: 400,
  height: 400,
  label: '',
  fillColor,
  ...over,
});

describe('labelBackdrops', () => {
  it('reads a label against the canvas when nothing is under it', () => {
    expect(labelBackdrops([text('a')], '#ffffff').get(0)).toEqual({
      ink: '#0f172a',
      behind: '#ffffff',
    });
  });

  it('reads it against the topmost larger panel painted before it, mixing a translucent one', () => {
    expect(labelBackdrops([panel('p', '#eef2ff'), text('a')], '#0f172a').get(1)?.behind).toBe(
      '#eef2ff',
    );
    const seen = labelBackdrops([panel('p', '#000000', { opacity: 0.5 }), text('a')], '#ffffff');
    expect(seen.get(1)?.behind).toMatch(/^#[0-9a-f]{6}$/i);
    expect(seen.get(1)?.behind).not.toBe('#000000');
  });

  it("reads a shape's label against its own fill, but a cycle's against what is behind it", () => {
    const box = { ...panel('b', '#334155'), label: 'Box', x: 0, y: 0, width: 50, height: 50 };
    expect(labelBackdrops([box], '#ffffff').get(0)?.behind).toBe('#334155');
    expect(labelBackdrops([{ ...box, shape: 'cycle' }], '#ffffff').get(0)?.behind).toBe('#ffffff');
  });

  it('files a panel too wide for the grid on the list every label checks', () => {
    const huge = panel('h', '#eef2ff', {
      x: -2_000_000,
      y: -2_000_000,
      width: 4_000_000,
      height: 4_000_000,
    });
    expect(labelBackdrops([huge, text('a')], '#0f172a').get(1)?.behind).toBe('#eef2ff');
  });

  it('leaves out labels with no words, and inks that are not a hex colour', () => {
    expect(
      labelBackdrops([text('a', { label: '  ' }), text('b', { textColor: 'red' })], '#ffffff').size,
    ).toBe(0);
  });
});

describe('withReadableLabelInks', () => {
  it('lifts a label the redraw sank under the floor, and keeps one it did not', () => {
    const board = [text('a'), panel('p', '#eef2ff', { x: 500 }), text('b', { x: 520 })];
    const out = withReadableLabelInks(board, '#ffffff', board, '#0f172a');
    expect(contrastRatio(out[0]!.textColor as string, '#0f172a')).toBeGreaterThanOrEqual(
      LABEL_BACKDROP_CONTRAST,
    );
    expect(out[2]).toBe(board[2]);
  });

  it('keeps a label that read as badly before: no redraw did that', () => {
    const board = [text('a')];
    expect(withReadableLabelInks(board, '#0f172a', board, '#0f172a')).toBe(board);
  });

  it("lifts a rich label's sunk runs the same way", () => {
    const rich = text('a', {
      label: '',
      richText: [{ text: 'x', color: '#0f172a' }, { text: 'y' }],
    });
    const out = withReadableLabelInks([rich], '#ffffff', [rich], '#0f172a');
    const runs = out[0]!.richText as { color?: string }[];
    expect(contrastRatio(runs[0]!.color!, '#0f172a')).toBeGreaterThanOrEqual(
      LABEL_BACKDROP_CONTRAST,
    );
    expect(runs[1]).toEqual({ text: 'y' });
  });

  it('gives each binding its own cache of walked inks', () => {
    const other = labelInks({ ...colours, reachContrast: () => '#fafafa' });
    const board = [text('a')];
    expect(other.withReadableLabelInks(board, '#ffffff', board, '#0f172a')[0]!.textColor).toBe(
      '#fafafa',
    );
    expect(withReadableLabelInks(board, '#ffffff', board, '#0f172a')[0]!.textColor).toBe('#ffffff');
  });
});
