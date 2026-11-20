// A board as the help's liveplanner scenes show it again and again: the white board card with its header row
// (./planner-chrome BoardHeader) over columns of cards (./plan-parts), sized to a rect. Scenes about presence,
// voting, tabs, saving and undo draw their story on top of one of these, so every one shows a real plan rather
// than a canvas of boxes. MiniBoard is the same board as a thumbnail (a library tile, a guest's browser).

import type { ReactNode } from 'react';
import { BoardHeader, ChromeCard, HEADER_H, type HeaderType } from './planner-chrome';
import { AddCard, Card, Column, cardH, type CardType, type Person } from './plan-parts';

export type FragCard = {
  type: CardType;
  num: number;
  title: string;
  who?: Person;
  priority?: 'High' | 'Medium' | 'Low';
  due?: string;
  /** Faded (a card the scene removes or that is mid-move). */
  muted?: boolean;
  selected?: boolean;
};

export type FragColumn = { name: string; count?: string; warn?: boolean; cards: FragCard[] };

/** Where the n-th card of a column sits in a BoardFragment, for placing cursors, counters and callouts. */
export function fragCardAt(
  frag: { x: number; y: number; w: number; header?: boolean; columns: number },
  col: number,
  row: number,
  face: 'compact' | 'full' = 'full',
): { x: number; y: number; w: number; h: number } {
  const colW = (frag.w - 12 - (frag.columns - 1) * 6) / frag.columns;
  const top = frag.y + (frag.header === false ? 6 : HEADER_H + 8);
  const h = face === 'full' ? cardH('full') : cardH('compact');
  return { x: frag.x + 6 + col * (colW + 6) + 6, y: top + 27 + row * (h + 5), w: colW - 12, h };
}

/** A board: the white card, its header row (unless `header` is false) and its columns of cards, `face` cards. */
export function BoardFragment({
  x,
  y,
  w,
  h,
  title = 'Sprint 12',
  types = [
    { name: 'User Story', icon: 'story', hue: 'violet' },
    { name: 'Task', icon: 'task', hue: 'gray' },
  ],
  columns,
  header = true,
  face = 'full',
  account = false,
  addCard = true,
  children,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  title?: string;
  types?: HeaderType[];
  columns: FragColumn[];
  header?: boolean;
  face?: 'compact' | 'full';
  account?: boolean;
  addCard?: boolean;
  /** Drawn over the board, under nothing (cursors, counters, toasts). */
  children?: ReactNode;
}) {
  const n = columns.length;
  const colW = (w - 12 - (n - 1) * 6) / n;
  const top = y + (header ? HEADER_H + 8 : 6);
  const pitch = (face === 'full' ? cardH('full') : cardH('compact')) + 5;
  return (
    <g>
      <ChromeCard x={x} y={y} w={w} h={h} r={8} />
      {header && <BoardHeader x={x} y={y} w={w} title={title} types={types} account={account} />}
      {columns.map((c, i) => {
        const cx = x + 6 + i * (colW + 6);
        return (
          <g key={c.name}>
            <Column
              x={cx}
              y={top}
              w={colW}
              h={y + h - 6 - top}
              name={c.name}
              count={c.count ?? String(c.cards.length)}
              warn={c.warn}
              controls={colW > 110}
            />
            {c.cards.map((card, k) => (
              <Card
                key={card.num}
                x={cx + 6}
                y={top + 27 + k * pitch}
                w={colW - 12}
                face={face}
                type={card.type}
                num={card.num}
                title={card.title}
                who={face === 'full' ? undefined : card.who}
                priority={face === 'full' ? card.priority : undefined}
                muted={card.muted}
                selected={card.selected}
                h={face === 'full' ? cardH('full') : undefined}
              />
            ))}
            {addCard && top + 27 + c.cards.length * pitch + 8 < y + h - 12 && (
              <AddCard x={cx + 8} y={top + 27 + c.cards.length * pitch + 6} />
            )}
          </g>
        );
      })}
      {children}
    </g>
  );
}

/** A board as a thumbnail: a white tile with three pale columns holding card bars, one in the accent. */
export function MiniBoard({
  x,
  y,
  w,
  h,
  cols = 3,
  className = 'fill-white stroke-slate-200',
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  cols?: number;
  className?: string;
}) {
  const pad = Math.max(3, w * 0.06);
  const colW = (w - pad * 2 - (cols - 1) * 3) / cols;
  const rows = [3, 2, 1, 2, 3];
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={4} className={className} strokeWidth={0.75} />
      {Array.from({ length: cols }, (_, i) => {
        const cx = x + pad + i * (colW + 3);
        const cardHgt = Math.max(3, (h - pad * 2 - 6) / 4.5);
        return (
          <g key={i}>
            <rect
              x={cx}
              y={y + pad}
              width={colW}
              height={h - pad * 2}
              rx={2}
              className="fill-slate-100"
            />
            {Array.from({ length: rows[i % rows.length]! }, (_, k) => (
              <rect
                key={k}
                x={cx + 1.5}
                y={y + pad + 4 + k * (cardHgt + 2)}
                width={colW - 3}
                height={cardHgt}
                rx={1.2}
                className={i === 1 && k === 0 ? 'fill-brand-200' : 'fill-white'}
              />
            ))}
          </g>
        );
      })}
    </g>
  );
}
