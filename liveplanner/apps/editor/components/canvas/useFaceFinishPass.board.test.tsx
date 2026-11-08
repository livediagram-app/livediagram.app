// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { act, cleanup, render } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MARKER_FACE_MAX_FRAMES, MARKER_FACE_MAX_PARTS } from '@liveplanner/project';
import { flushFaceTakes } from '@liveworkspace/workbench/components/canvas/face-take-batch';
import { COLUMN_HOVER_ATTR } from '@/components/plan/useColumnHover';
import { SPOTLIGHT_X, SPOTLIGHT_Y } from '@/components/plan/useCardSpotlight';
import { drawMarkerFace, useFaceFinishPass } from './useFaceFinishPass';

// A busy Plan board under Marker (docs/specs/008-canvas/finish.md "Marker", docs/specs/026-plan/plan-board.md "Card
// hover"): every card keeps its marker edge, and the pointer moving over the board (a column's tint, a card's light)
// never re-takes the face. Moving the pointer re-took a 200-card board about once a second, and each re-take read the
// cards it had just drawn mid-fade (no line), so their borders went plain and stayed plain. jsdom lays nothing out, so
// each box is given its size through data-w / data-h.
const size = (key: 'offsetWidth' | 'offsetHeight', attr: string) =>
  Object.defineProperty(HTMLElement.prototype, key, {
    configurable: true,
    get(this: HTMLElement) {
      return Number(this.getAttribute(attr) ?? 0);
    },
  });

beforeEach(() => {
  size('offsetWidth', 'data-w');
  size('offsetHeight', 'data-h');
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  delete (HTMLElement.prototype as { offsetWidth?: number }).offsetWidth;
  delete (HTMLElement.prototype as { offsetHeight?: number }).offsetHeight;
});

const COLUMNS = ['backlog', 'todo', 'doing', 'review', 'done'];
const CARDS = 200;
const cardStyle = {
  position: 'relative',
  border: '1px solid rgb(226, 232, 240)',
  borderRadius: 12,
  '--card-line': 'rgb(226, 232, 240)',
} as React.CSSProperties;

function Board({ cards = CARDS, title = 'Card' }: { cards?: number; title?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useFaceFinishPass(ref, 'marker', 'board');
  return (
    <div ref={ref} data-w="1400" data-h="4000" style={{ position: 'absolute' }}>
      {COLUMNS.map((column) => (
        <div key={column} className="plan-col" data-plan-column={column} data-plan-lane="">
          {Array.from({ length: cards }, (_, i) => i)
            .filter((i) => i % COLUMNS.length === COLUMNS.indexOf(column))
            .map((i) => (
              <div
                key={i}
                data-plan-card={`c${i}`}
                className="plan-card plan-card-hover"
                data-w="260"
                data-h="100"
                style={cardStyle}
              >
                {title} {i}
              </div>
            ))}
        </div>
      ))}
    </div>
  );
}

const inkOf = (card: Element) => card.querySelector(':scope > svg[data-marker-ink]');
const cardsOf = (root: ParentNode) => [...root.querySelectorAll('[data-plan-card]')];

describe('a busy Plan board in marker', () => {
  it(`outlines every card, past ${MARKER_FACE_MAX_PARTS} parts`, () => {
    const { container } = render(<Board />);
    // Taken with the board's other faces at the end of the task that mounted it (face-take-batch.ts).
    act(() => flushFaceTakes());
    const cards = cardsOf(container);
    expect(cards).toHaveLength(CARDS);
    expect(
      cards.filter((card) => inkOf(card) && card.hasAttribute('data-marker-drawn')),
    ).toHaveLength(CARDS);
  });

  it('keeps every card’s ink, untouched, while the pointer moves over the board', async () => {
    vi.useFakeTimers();
    const { container } = render(<Board />);
    await act(async () => {});
    const cards = cardsOf(container);
    const before = cards.map(inkOf);
    // The pointer crosses every column and card: the column's tint and the card's light, written as the hooks do.
    for (const [i, card] of cards.entries()) {
      const column = card.closest('[data-plan-column]')!;
      column.setAttribute(COLUMN_HOVER_ATTR, '');
      (card as HTMLElement).style.setProperty(SPOTLIGHT_X, `${i % 200}px`);
      (card as HTMLElement).style.setProperty(SPOTLIGHT_Y, `${i % 90}px`);
      await vi.advanceTimersByTimeAsync(16);
      column.removeAttribute(COLUMN_HOVER_ATTR);
    }
    await vi.advanceTimersByTimeAsync(2000);
    // No re-take: every card holds the very ink it was drawn with, and nothing was added.
    expect(cards.map(inkOf)).toEqual(before);
    expect(container.querySelectorAll('[data-marker-ink]')).toHaveLength(CARDS);
  });

  it('still re-takes on a real change, drawing every card the same', async () => {
    vi.useFakeTimers();
    const { container, rerender } = render(<Board />);
    await act(async () => {});
    const ink = cardsOf(container).map((card) => inkOf(card)!.innerHTML);
    rerender(<Board title="Task" />);
    await vi.advanceTimersByTimeAsync(2000);
    const after = cardsOf(container);
    expect(after.every((card) => card.hasAttribute('data-marker-drawn'))).toBe(true);
    expect(after.map((card) => inkOf(card)!.innerHTML)).toEqual(ink);
    expect(container.querySelectorAll('[data-marker-ink]')).toHaveLength(CARDS);
  });

  it(`outlines at most ${MARKER_FACE_MAX_FRAMES} cards`, () => {
    const { container } = render(<Board cards={MARKER_FACE_MAX_FRAMES + 10} />);
    act(() => flushFaceTakes());
    expect(container.querySelectorAll('[data-marker-ink]')).toHaveLength(MARKER_FACE_MAX_FRAMES);
  });
});

describe('a take', () => {
  it('reads every part with the face held still, and marks only after every read', () => {
    const { container } = render(<Board cards={20} />);
    const root = container.firstElementChild as HTMLElement;
    const read = window.getComputedStyle;
    const reads: { held: boolean; marked: number }[] = [];
    const spy = vi.spyOn(window, 'getComputedStyle').mockImplementation((el, pseudo) => {
      if (el instanceof HTMLElement && el.hasAttribute('data-plan-card') && !reads.at(-1)?.marked)
        reads.push({
          held: root.hasAttribute('data-marker-taking'),
          marked: root.querySelectorAll('[data-marker-ink]').length,
        });
      return read(el, pseudo);
    });
    try {
      expect(drawMarkerFace(root, 'board')).toBe(20);
    } finally {
      spy.mockRestore();
    }
    const firstMarks = reads.findIndex((r) => r.marked > 0);
    const before = firstMarks === -1 ? reads : reads.slice(0, firstMarks);
    expect(before).toHaveLength(20);
    expect(before.every((r) => r.held && r.marked === 0)).toBe(true);
    expect(root.hasAttribute('data-marker-taking')).toBe(false);
  });

  it('holds every transition while it reads (face-finish.css)', () => {
    const css = readFileSync(join(__dirname, '../../app/face-finish.css'), 'utf8');
    expect(css).toMatch(
      /\[data-marker-taking\],\s*\[data-marker-taking\] \*\s*\{\s*transition: none !important;/,
    );
  });
});
