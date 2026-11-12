// @vitest-environment jsdom

// Cards fan in (docs/specs/026-plan/plan-board.md "Cards fan in"): once, as the board first shows its cards, at most
// 80 of them; a board holding more than FAN_IN_MAX_BOARD_CARDS just shows, reading no card's place, so 2,000 cards
// (a big board opened, or a tab's whole plan imported onto it) never lay the board out in one task (Work Item 245).
import { cleanup, render } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { FAN_IN_MAX_BOARD_CARDS, useCardFanIn } from './useCardFanIn';

let animate: ReturnType<typeof vi.fn>;
let boxes: ReturnType<typeof vi.fn>;

beforeEach(() => {
  animate = vi.fn();
  // Every card in view: the grid and each card take up the top of the window.
  boxes = vi.fn(() => ({ top: 0, bottom: 100, left: 0, right: 100 }) as DOMRect);
  HTMLElement.prototype.animate = animate as unknown as HTMLElement['animate'];
  HTMLElement.prototype.getBoundingClientRect = boxes as unknown as () => DOMRect;
});
afterEach(cleanup);

// The board's grid with `built` cards drawn (a busy board draws only its near runs') and `count` on the board.
function Board({ ready, count, built = count }: { ready: boolean; count: number; built?: number }) {
  const grid = useRef<HTMLDivElement>(null);
  useCardFanIn(grid, ready, count);
  return (
    <div ref={grid}>
      {Array.from({ length: built }, (_, i) => (
        <div key={i} data-plan-card="" />
      ))}
    </div>
  );
}

describe('useCardFanIn', () => {
  it('fans in at most 80 of the cards a board opens with', () => {
    render(<Board ready count={300} />);
    expect(animate).toHaveBeenCalledTimes(80);
  });

  it('fans in a few cards arriving soon after the board was ready and empty, then never again', () => {
    const view = render(<Board ready count={0} />);
    view.rerender(<Board ready count={5} />);
    expect(animate).toHaveBeenCalledTimes(5);
    view.rerender(<Board ready count={6} />);
    expect(animate).toHaveBeenCalledTimes(5);
  });

  it('fans in a board of exactly the bound', () => {
    render(<Board ready count={FAN_IN_MAX_BOARD_CARDS} built={100} />);
    expect(animate).toHaveBeenCalledTimes(80);
  });

  it('lets a board past the bound just show, reading no card’s place, opened or imported', () => {
    render(<Board ready count={2000} built={200} />);
    const view = render(<Board ready count={0} />);
    const ms = cpuMsOf(() => view.rerender(<Board ready count={2000} built={200} />));
    expect(animate).not.toHaveBeenCalled();
    expect(boxes).not.toHaveBeenCalled();
    expect(ms).toBeLessThan(cpuBudgetMs(200));
  });
});
