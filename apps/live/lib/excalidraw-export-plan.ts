// Plan boards and cards in the Excalidraw export (docs/specs/020-import-export/excalidraw-import-export.md,
// docs/specs/026-plan/items.md "Copies and exports"): a board's title, columns and card faces, laid out as the
// image export lays them out (planBoardLayout), each a plain part the exporter turns into Excalidraw elements.

import {
  canvasSurface,
  planBoardLayout,
  planPalette,
  type BoxedElement,
  type TabPlanData,
} from '@livediagram/document';
import { itemTitle, type Item } from '@livediagram/items';

export type PlanPart = {
  id: string;
  kind: 'rect' | 'text';
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
  stroke: string;
  ink: string;
  label: string;
};

type PlanShape = BoxedElement & { type: 'shape' };

// `#12 Title`, a card face's words.
export const planCardText = (item: Item | undefined): string =>
  item ? `#${item.key} ${itemTitle(item).trim() || 'Untitled'}` : 'Card not found';

// A Plan card's label, or undefined without the items (it then exports as its bare box).
export function planCardLabel(el: PlanShape, plan: TabPlanData | undefined): string | undefined {
  if (!plan) return undefined;
  const id = el.planCard?.itemId;
  return planCardText(id ? plan.items.get(id) : undefined);
}

// The parts drawn over a board's frame, in paint order: title, then each column and its cards.
export function planBoardParts(
  el: PlanShape,
  plan: TabPlanData | undefined,
  backgroundColor: string,
): PlanPart[] {
  const layout = planBoardLayout(el, plan?.items, plan?.types);
  if (!layout) return [];
  const p = planPalette(canvasSurface(backgroundColor), {
    fill: el.fillColor,
    stroke: el.strokeColor,
    text: el.textColor,
  });
  const parts: PlanPart[] = [
    {
      id: `${el.id}-title`,
      kind: 'text',
      x: el.x + 16,
      y: el.y + 14,
      width: el.width / 2,
      height: 24,
      fill: 'transparent',
      stroke: 'transparent',
      ink: p.text,
      label: layout.setup.title,
    },
  ];
  layout.columns.forEach((col, i) => {
    const count = col.column.wipLimit ? `${col.count} / ${col.column.wipLimit}` : `${col.count}`;
    parts.push({
      id: `${el.id}-column-${i}`,
      kind: 'rect',
      x: col.x,
      y: col.y,
      width: col.width,
      height: col.height,
      fill: p.column,
      stroke: p.column,
      ink: p.text,
      label: '',
    });
    parts.push({
      id: `${el.id}-column-${i}-name`,
      kind: 'text',
      x: col.x + 10,
      y: col.y + 8,
      width: col.width - 20,
      height: 20,
      fill: 'transparent',
      stroke: 'transparent',
      ink: p.text,
      label: `${col.column.name} · ${count}`,
    });
    for (const card of col.cards) {
      parts.push({
        id: `${el.id}-card-${card.item.id}`,
        kind: 'rect',
        x: card.x,
        y: card.y,
        width: card.width,
        height: card.height,
        fill: p.card,
        stroke: p.cardBorder,
        ink: p.text,
        label: planCardText(card.item),
      });
    }
  });
  return parts;
}
