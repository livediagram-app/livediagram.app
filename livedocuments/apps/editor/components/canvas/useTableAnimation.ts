import { useMemo, type CSSProperties } from 'react';
import type { TableElement } from '@livedocuments/document';
import { bodySetClass } from '@/lib/animation-classes';
import { unitCount } from './animated-words';
import { useTextAnimation, type TextAnimView } from './useTextAnimation';

// Where each count starts: the sum of the counts before it.
function startsOf(counts: number[]): number[] {
  const starts: number[] = [];
  let sum = 0;
  for (const count of counts) {
    starts.push(sum);
    sum += count;
  }
  return starts;
}

// A table's animations (docs/specs/028-animation/element-animations.md "Table" and "Text"): the
// Table set's class on the grid, with the row and column counts its cascades stagger by, and the
// Text animation of its cells, counted across every cell in reading order as one label (EA5), each
// cell starting its units where the cell before it ended.
export function useTableAnimation(
  element: TableElement,
  textColor: string,
  isEditing: boolean,
): {
  gridClass: string | undefined;
  gridStyle: CSSProperties | undefined;
  textAnim: TextAnimView | undefined;
  textStarts: number[][] | undefined;
} {
  const texts = useMemo(() => element.cells.flat(), [element.cells]);
  const textAnim = useTextAnimation(element, texts, textColor, isEditing);
  const textStarts = useMemo(() => {
    if (!textAnim) return undefined;
    const counts = element.cells.map((row) => row.map((cell) => unitCount(cell, textAnim.plan)));
    const starts = startsOf(counts.flat());
    const firstOfRow = startsOf(counts.map((row) => row.length));
    return counts.map((row, r) => row.map((_, c) => starts[firstOfRow[r]! + c]!));
  }, [element.cells, textAnim]);
  const gridClass = bodySetClass(element, 'table');
  const rows = element.cells.length;
  const cols = element.cells[0]?.length ?? 0;
  return {
    gridClass,
    gridStyle: gridClass
      ? ({ '--lvd-rows': rows, '--lvd-cols': cols } as CSSProperties)
      : undefined,
    textAnim,
    textStarts,
  };
}
