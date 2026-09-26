import { Children, isValidElement, type ReactNode } from 'react';

// Variable-height cards (rankings, whose length follows the data) in two
// independent columns, so each card is only as tall as its own content
// (docs/specs/017-telemetry/telemetry.md). In a grid every row grows to its tallest card: one long ranking
// (Tools, Live's pages) stretched its short neighbour into a mostly-empty box.
//
// Placed, not flowed. CSS `columns` fills top to bottom in source order, so a
// long card late in the list piled onto an already-long column (Tools under
// Shapes and Collaborate on Palette). Instead the cards go biggest first, each
// into whichever column is shorter so far, which keeps the two close to even.
// Below `lg` it is one column in the same order.
//
// A card's size is estimated from its rows: a child with an `items` array (a
// RankCard) weighs its row count plus its header, and an empty one weighs as
// much as its "Nothing yet" panel. Anything else can pass `weight` directly.

const HEADER = 3; // title + subtitle, in rows
const EMPTY = 6; // the EmptyState panel, in rows

export function weightOf(node: ReactNode): number {
  if (!isValidElement<{ items?: unknown[]; weight?: number }>(node)) return EMPTY;
  const { items, weight } = node.props;
  if (typeof weight === 'number') return weight;
  if (Array.isArray(items)) return HEADER + (items.length === 0 ? EMPTY : items.length);
  return EMPTY;
}

/**
 * Split card weights into two columns: biggest first (ties in source order),
 * each into whichever column is shorter so far. Returns each column's card
 * indices, top to bottom.
 */
export function balanceColumns(weights: number[]): [number[], number[]] {
  const order = weights
    .map((weight, index) => ({ weight, index }))
    .sort((a, b) => b.weight - a.weight || a.index - b.index);
  const columns: [number[], number[]] = [[], []];
  const heights = [0, 0];
  for (const { weight, index } of order) {
    const shorter = heights[0]! <= heights[1]! ? 0 : 1;
    columns[shorter].push(index);
    heights[shorter]! += weight;
  }
  return columns;
}

export function CardColumns({ children }: { children: ReactNode }) {
  const nodes = Children.toArray(children);
  const columns = balanceColumns(nodes.map(weightOf));
  return (
    <div className="grid items-start gap-6 lg:grid-cols-2">
      {columns.map((column, i) => (
        <div key={i} className="flex flex-col gap-6">
          {column.map((index) => nodes[index])}
        </div>
      ))}
    </div>
  );
}
