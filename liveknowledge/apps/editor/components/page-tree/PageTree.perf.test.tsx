// @vitest-environment jsdom

// The page tree at its limit (docs/specs/030-knowledgebase/blueprints/page-tree.md "Performance and limits"): 500
// rows render within budget without windowing, and a hover or a drag across them renders the rows it leaves and
// enters, never the list.
import { cleanup, createEvent, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cpuBudgetMs, cpuNowMs } from '@liveworkspace/vitest-config/cpu-time';
import { MAX_KNOWLEDGEBASE_PAGES } from '@liveknowledge/document';
import type { TreeTab } from './page-tree-view';

// Every render of a row calls its mark hook once: counted here, per row.
const rowRenders = vi.hoisted(() => new Map<string, number>());
vi.mock('./page-tree-ui', async (original) => {
  const real = await original<typeof import('./page-tree-ui')>();
  return {
    ...real,
    useRowMark: (...args: Parameters<typeof real.useRowMark>) => {
      rowRenders.set(args[1], (rowRenders.get(args[1]) ?? 0) + 1);
      return real.useRowMark(...args);
    },
  };
});

const { PageTree } = await import('./PageTree');

// 500 pages: 100 top-level pages, each with four subpages.
const FULL: TreeTab[] = Array.from({ length: MAX_KNOWLEDGEBASE_PAGES }, (_, i) => ({
  id: `t${i}`,
  name: `Page ${i}`,
  parent: i % 5 === 0 ? undefined : `t${i - (i % 5)}`,
}));
const NONE: ReadonlySet<string> = new Set();
const noop = () => {};
const ACTIONS = {
  onSelect: noop,
  onRename: noop,
  onAdd: noop,
  onDuplicate: noop,
  onDelete: noop,
  onMove: vi.fn(),
  onStep: noop,
  onIndent: noop,
  onOutdent: noop,
  onCopyLink: noop,
};

const mount = () =>
  render(
    <PageTree tabs={FULL} activeId="t0" closed={NONE} onSetOpen={noop} canEdit actions={ACTIONS} />,
  );
const row = (i: number) => document.querySelector<HTMLElement>(`[data-page-row="t${i}"]`)!;
const total = () => [...rowRenders.values()].reduce((sum, n) => sum + n, 0);

beforeEach(() => {
  rowRenders.clear();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: HTMLElement,
  ) {
    const top = Number(this.dataset.pageRow?.slice(1) ?? 0) * 32;
    return {
      top,
      bottom: top + 32,
      left: 0,
      right: 264,
      width: 264,
      height: 32,
      x: 0,
      y: top,
      toJSON: () => ({}),
    };
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// The budgets are CPU time (cpuBudgetMs); the wall-clock timeout only stops a hang, so a busy CI runner's waits never
// fail a run that stayed within budget (docs/ci.md "Speed budgets").
describe('500 pages', { timeout: 30_000 }, () => {
  it('render every row once, within budget, with no windowing', () => {
    const start = cpuNowMs();
    mount();
    const spent = cpuNowMs() - start;
    expect(screen.getAllByRole('treeitem')).toHaveLength(MAX_KNOWLEDGEBASE_PAGES);
    expect(total()).toBe(MAX_KNOWLEDGEBASE_PAGES);
    // jsdom renders far slower than a browser lays out; the budget is for the React work alone.
    expect(spent).toBeLessThan(cpuBudgetMs(1500));
    console.info(`[page-tree] 500 rows first render: ${spent.toFixed(0)} ms CPU (jsdom)`);
  });

  it('render only the rows a hover leaves and enters', () => {
    mount();
    rowRenders.clear();
    fireEvent.pointerOver(row(10));
    expect(total()).toBe(1);
    fireEvent.pointerOver(row(11));
    // The row left and the row entered.
    expect(total()).toBe(3);
    expect(rowRenders.get('t10')).toBe(2);
    expect(rowRenders.get('t11')).toBe(1);
  });

  it('render at most two rows a pointer move while a row is dragged across the list', () => {
    mount();
    const dataTransfer = { setData: vi.fn(), getData: vi.fn(), effectAllowed: '', dropEffect: '' };
    fireEvent.dragStart(row(499), { dataTransfer });
    rowRenders.clear();
    const over = (i: number, y: number) => {
      const event = createEvent.dragOver(row(i), { dataTransfer });
      Object.defineProperty(event, 'clientY', { value: i * 32 + y });
      fireEvent(row(i), event);
    };
    let moves = 0;
    const start = cpuNowMs();
    // Down the first 100 rows, three pointer moves a row (its top edge, its middle, its bottom edge), then the
    // same again without leaving a zone.
    for (let i = 0; i < 100; i++) {
      for (const y of [2, 16, 30, 31]) {
        const before = total();
        over(i, y);
        moves += 1;
        expect(total() - before).toBeLessThanOrEqual(2);
      }
    }
    const spent = cpuNowMs() - start;
    // 400 moves over 500 rows: at most two row renders each, and none for a move inside the same zone.
    expect(total()).toBeLessThanOrEqual(moves * 2);
    expect(total()).toBeLessThan(moves * 1.6);
    expect(spent).toBeLessThan(cpuBudgetMs(2000));
    console.info(
      `[page-tree] drag over 500 rows: ${moves} moves, ${total()} row renders, ${spent.toFixed(0)} ms CPU (jsdom)`,
    );
    fireEvent.drop(row(99), { dataTransfer });
    expect(ACTIONS.onMove).toHaveBeenCalledTimes(1);
  });

  it('render two rows when the current page changes, and none when the list is the same', () => {
    const view = mount();
    rowRenders.clear();
    view.rerender(
      <PageTree
        tabs={FULL}
        activeId="t0"
        closed={NONE}
        onSetOpen={noop}
        canEdit
        actions={ACTIONS}
      />,
    );
    expect(total()).toBe(0);
    view.rerender(
      <PageTree
        tabs={FULL}
        activeId="t7"
        closed={NONE}
        onSetOpen={noop}
        canEdit
        actions={ACTIONS}
      />,
    );
    // The page left and the page entered (each also the Tab stop).
    expect(total()).toBe(2);
  });
});
