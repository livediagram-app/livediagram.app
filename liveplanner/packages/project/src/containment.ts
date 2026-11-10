// Derived containment: one copy for every product, @liveworkspace/element-model/containment; the Sheet's charts are
// liveplanner's own.
import type { Element, ElementId } from './index';
import { hasGeometry } from '@liveworkspace/element-model/containment';

export * from '@liveworkspace/element-model/containment';

type Boxed = Element & { x: number; y: number; width: number; height: number };

// A Sheet carries the charts drawn from its own sheet that sit on it (docs/specs/029-sheets/sheet.md "Charts"): a
// chart anchored in it always, and a floating chart whose centre is inside a moved Sheet's box; one dragged off onto
// the canvas stays put. `ids` unchanged when no Sheet is among them. `anchoredOnly` takes only the charts anchored in
// a Sheet (a delete or a Clear Sheet): a floating chart that merely sits over a deleted Sheet stays on the canvas.
export function withSheetCharts(
  elements: readonly Element[],
  ids: ReadonlySet<ElementId>,
  opts: { anchoredOnly?: boolean } = {},
): ReadonlySet<ElementId> {
  const sheets = elements.filter(
    (el): el is Boxed & { type: 'shape'; planSheet?: { sheetId: string } } =>
      ids.has(el.id) && el.type === 'shape' && el.shape === 'plan-sheet' && hasGeometry(el),
  );
  if (sheets.length === 0) return ids;
  const out = new Set(ids);
  for (const el of elements) {
    if (out.has(el.id) || el.type !== 'shape' || !el.chartSource || !hasGeometry(el)) continue;
    if (el.sheetAnchor && sheets.some((s) => s.planSheet?.sheetId === el.chartSource!.sheetId)) {
      out.add(el.id);
      continue;
    }
    if (opts.anchoredOnly) continue;
    const cx = el.x + el.width / 2;
    const cy = el.y + el.height / 2;
    if (
      sheets.some(
        (s) =>
          s.planSheet?.sheetId === el.chartSource!.sheetId &&
          cx >= s.x &&
          cx <= s.x + s.width &&
          cy >= s.y &&
          cy <= s.y + s.height,
      )
    )
      out.add(el.id);
  }
  return out;
}
