import { describe, expect, it, vi } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import type { BoxedElement, Element, TableElement } from './element';
import { penColourHex } from './pen-colours';
import { tableHeaderColours } from './table-header-colours';
import { textGroundIn, type TextGround } from './text-contrast';
import { tableTextCells, textContrastProbesFor } from './text-contrast-probe';
import { textGroundMemo, type ProbeTab } from './text-ground-memo';

// Each product's docs/specs/004-interface-design/colour-picker.md "Reading on its ground", and its blueprint's
// "Performance and limits": the shared probes, on a model whose texts read on a canvas of the tab's colour.
type Tab = ProbeTab & { backgroundColor?: string };
const canvas = (tab: Tab): TextGround => ({
  tones: [tab.backgroundColor ?? '#ffffff'],
  on: 'canvas',
});
const groundOf = (el: BoxedElement, tab: Tab) =>
  textGroundIn(el, tab.elements, 'light', () => canvas(tab));
const model = {
  groundOf,
  defaultTextColor: (_el: BoxedElement, surface: 'light' | 'dark') =>
    surface === 'dark' ? '#f8fafc' : '#0f172a',
  exported: (ground: TextGround, surface: 'light' | 'dark') =>
    ground.on === 'canvas' && surface === 'dark',
};
const { textContrastProbe, textContrastProbes, cellContrastProbes } = textContrastProbesFor(model);

const el = (id: string, type: string, extra: object = {}, x = 40, y = 40) =>
  ({ id, type, x, y, width: 120, height: 30, label: 'Hi', ...extra }) as unknown as Element;

describe('textContrastProbe', () => {
  it('reads a colour of its own, a stock name in its version for the ground, or the default ink', () => {
    const t = el('t', 'text', { textColor: '#FDE047' });
    expect(textContrastProbe(t, { elements: [t] }, 'light')!.current).toBe('#fde047');
    const named = el('t', 'text', { penTextColour: 'blue' });
    const dark = { elements: [named], backgroundColor: '#0f172a' };
    const probe = textContrastProbe(named, dark, 'light')!;
    expect(probe.current).toBe(penColourHex('blue', 'dark'));
    expect(probe.colourOf('ink')).toBe(penColourHex('ink', 'dark'));
    expect(probe.colourOf('#ABCDEF')).toBe('#abcdef');
    expect(probe.colourOf('transparent')).toBeNull();
    const plain = el('t', 'text');
    expect(textContrastProbe(plain, { elements: [plain] }, 'light')!.current).toBe('#0f172a');
    expect(textContrastProbe(plain, { ...dark, elements: [plain] }, 'light')!.current).toBe(
      '#f8fafc',
    );
  });

  it('marks large text, and what is judged as saved', () => {
    const big = el('b', 'text', { textSize: 32 });
    expect(textContrastProbe(big, { elements: [big] }, 'light')!.large).toBe(true);
    expect(textContrastProbe(big, { elements: [big] }, 'light')!.exported).toBe(false);
    expect(textContrastProbe(big, { elements: [big] }, 'dark')!.exported).toBe(true);
  });

  it('judges nothing for a line or where the model judges no ground', () => {
    const arrow = { id: 'a', type: 'arrow' } as unknown as Element;
    expect(textContrastProbe(arrow, { elements: [arrow] }, 'light')).toBeNull();
    const t = el('t', 'text');
    const image = el('img', 'image', { x: 0, y: 0, width: 400, height: 400 });
    expect(textContrastProbe(t, { elements: [image, t] }, 'light')).toBeNull();
    expect(textContrastProbes([t], { elements: [image, t] }, 'light')).toBeUndefined();
    expect(textContrastProbes([t, arrow], { elements: [t, arrow] }, 'light')).toHaveLength(1);
  });
});

describe('cellContrastProbes', () => {
  const table = (extra: Partial<TableElement> = {}) =>
    ({
      id: 'tbl',
      type: 'table',
      x: 0,
      y: 0,
      width: 300,
      height: 90,
      cells: [
        ['a', 'b', 'c'],
        ['d', 'e', 'f'],
        ['g', 'h', 'i'],
      ],
      ...extra,
    }) as TableElement;
  const all = [0, 1, 2].flatMap((r) => [0, 1, 2].map((c) => ({ r, c })));

  it('shares one probe between cells alike, counting them', () => {
    const t = table({ textColor: '#fde047' });
    const probes = cellContrastProbes(t, all, { elements: [t] }, 'light')!;
    expect(probes).toHaveLength(1);
    expect(probes[0]).toMatchObject({ current: '#fde047', count: 9, ground: { on: 'canvas' } });
  });

  it('reads a cell on its background in its own ink, a header in its band ink', () => {
    const t = table({
      headerRow: true,
      cellStyles: [[], [{ bg: '#1e293b', textColor: '#334155' }]],
    });
    const probes = cellContrastProbes(
      t,
      [
        { r: 0, c: 0 },
        { r: 1, c: 0 },
        { r: 2, c: 2 },
      ],
      { elements: [t] },
      'light',
    )!;
    expect(probes.map((p) => p.current)).toEqual([
      tableHeaderColours(t, 'light').ink,
      '#334155',
      '#0f172a',
    ]);
    expect(probes[1]!.ground).toEqual({ tones: ['#1e293b'], on: 'cell' });
  });

  it('judges a table selected whole on the body cells its text colour reaches', () => {
    const t = table({
      headerRow: true,
      textColor: '#fde047',
      cellStyles: [[], [{ textColor: '#000000' }], [{ bg: '#0f172a' }]],
    });
    expect(tableTextCells(t)).toEqual([
      { r: 1, c: 1 },
      { r: 1, c: 2 },
      { r: 2, c: 0 },
      { r: 2, c: 1 },
      { r: 2, c: 2 },
    ]);
    const probes = textContrastProbes([t], { elements: [t] }, 'light')!;
    expect(probes.map((p) => [p.ground.on, p.count])).toEqual([
      ['canvas', 4],
      ['cell', 1],
    ]);
    expect(tableTextCells(table({ cells: undefined }))).toEqual([]);
    const image = el('img', 'image', { x: 0, y: 0, width: 400, height: 400 });
    // On a picture only the cell with a background of its own can be judged.
    expect(textContrastProbes([t], { elements: [image, t] }, 'light')).toHaveLength(1);
    const plain = table({ textColor: '#fde047' });
    expect(textContrastProbes([plain], { elements: [image, plain] }, 'light')).toBeUndefined();
  });

  it('is undefined when no cell can be judged', () => {
    const t = table();
    const image = el('img', 'image', { x: 0, y: 0, width: 400, height: 400 });
    expect(cellContrastProbes(t, all, { elements: [image, t] }, 'light')).toBeUndefined();
  });

  it('stays quick on a whole 100 by 100 table selected', () => {
    const cells = Array.from({ length: 100 }, () => Array.from({ length: 100 }, () => 'x'));
    const t = table({ cells, zebra: true });
    const every = cells.flatMap((row, r) => row.map((_, c) => ({ r, c })));
    let n = 0;
    const ms = cpuMsOf(() => {
      n = cellContrastProbes(t, every, { elements: [t] }, 'light')!.length;
    });
    // Two grounds: the plain rows and the banded ones.
    expect(n).toBe(2);
    expect(ms).toBeLessThan(cpuBudgetMs(100));
  });
});

describe('textGroundMemo', () => {
  const t = el('t', 'text') as BoxedElement;
  const card = el('card', 'shape', {
    shape: 'square',
    x: 0,
    y: 0,
    width: 300,
    height: 200,
    fillColor: '#fef3c7',
  });

  it('reuses a ground while only the text colour changes, and works it out again when the canvas does', () => {
    const compute = vi.fn(groundOf);
    const memo = textGroundMemo(compute);
    const line = { id: 'a', type: 'arrow' } as unknown as Element;
    const tab = { elements: [line, card, t] };
    expect(memo.batch()(t, tab, 'light')).toEqual({ tones: ['#fef3c7'], on: 'card' });
    const recoloured = { ...t, textColor: '#ff0000' } as BoxedElement;
    memo.batch()(recoloured, { elements: [line, card, recoloured] }, 'light');
    expect(compute).toHaveBeenCalledTimes(1);
    memo.batch()(recoloured, { elements: [card, recoloured], backgroundColor: '#000000' }, 'light');
    memo.batch()(recoloured, { elements: [card, recoloured], backgroundColor: '#000000' }, 'dark');
    expect(compute).toHaveBeenCalledTimes(3);
    // A setting other than its colour, or a box under it, works it out again.
    const bold = { ...recoloured, textBold: true } as BoxedElement;
    memo.batch()(bold, { elements: [card, bold], backgroundColor: '#000000' }, 'dark');
    expect(compute).toHaveBeenCalledTimes(4);
    const recard = { ...card, fillColor: '#0f172a' } as Element;
    memo.batch()(bold, { elements: [recard, bold], backgroundColor: '#000000' }, 'dark');
    expect(compute).toHaveBeenCalledTimes(5);
  });
});
