import { useMemo, type CSSProperties } from 'react';
import type { TableElement } from '@livediagram/document';
import { bodySetClass } from '@/lib/animation-classes';
import { unitCount } from './animated-words';
import { useTextAnimation, type TextAnimView } from './useTextAnimation';

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
    let next = 0;
    return element.cells.map((row) =>
      row.map((cell) => {
        const start = next;
        next += unitCount(cell, textAnim.plan);
        return start;
      }),
    );
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
