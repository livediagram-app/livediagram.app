// A tab's Plan items in its text exports (docs/specs/026-plan/items.md "Copies and exports"): the items a
// tab's JSON export carries, and the Plan section of its Markdown outline. Pure.

import {
  isTrashed,
  itemIdsShownOnTab,
  itemTitle,
  typeIn,
  type Item,
  type ItemTypeCatalogue,
  type ItemTypeDef,
} from '@livediagram/items';
import type { ShapeElement, Tab } from './index';
import { planBoardLayout } from './plan-board-layout';

// The document's item store and type catalogue, as an export reads them.
export interface TabPlanData {
  items: ReadonlyMap<string, Item>;
  types: readonly ItemTypeDef[];
  // The stored catalogue; null while the document uses the built-in types.
  catalogue: ItemTypeCatalogue | null;
}

// The items a tab shows, the Trash left out, in number order, each without its votes or comments (the file
// travels, and those name people).
export function tabExportItems(
  tab: Pick<Tab, 'elements'>,
  items: ReadonlyMap<string, Item>,
): Item[] {
  const out: Item[] = [];
  for (const id of itemIdsShownOnTab(tab.elements, items.values())) {
    const item = items.get(id);
    if (!item || isTrashed(item)) continue;
    const { votes: _votes, comments: _comments, ...fields } = item.fields;
    out.push({ ...item, fields });
  }
  return out.sort((a, b) => a.key - b.key);
}

// `#12 Title (Task)`, a card as the Markdown outline lists it.
function cardLine(item: Item | undefined, types: readonly ItemTypeDef[]): string {
  if (!item) return '- _Card not found_';
  const title = itemTitle(item).trim() || 'Untitled';
  return `- #${item.key} ${title} (${typeIn(types, item.type).label})`;
}

// The outline's Plan Boards and Plan Cards sections, top to bottom then left to right; empty when the tab has
// neither. Every card a column holds is listed, not only those an image has room for.
export function tabPlanMarkdown(tab: Pick<Tab, 'elements'>, plan: TabPlanData): string[] {
  const placed = tab.elements
    .filter((el): el is ShapeElement => el.type === 'shape')
    .sort((a, b) => a.y - b.y || a.x - b.x);
  const lines: string[] = [];
  const boardLines: string[] = [];
  for (const el of placed.filter((s) => s.shape === 'plan-board')) {
    const layout = planBoardLayout(el, plan.items, plan.types);
    if (!layout) continue;
    boardLines.push(`### ${layout.setup.title.trim() || 'Untitled board'}`, '');
    for (const col of layout.projection.columns) {
      boardLines.push(`#### ${col.column.name} · ${col.count}`, '');
      const cards = col.lanes.flatMap((l) => l.items);
      if (cards.length === 0) boardLines.push('_No cards._');
      for (const item of cards) boardLines.push(cardLine(item, plan.types));
      boardLines.push('');
    }
  }
  if (boardLines.length > 0) lines.push('## Plan Boards', '', ...boardLines);
  const cards = placed.filter((s) => s.shape === 'plan-card');
  if (cards.length > 0) {
    lines.push('## Plan Cards', '');
    for (const el of cards) {
      const id = el.planCard?.itemId;
      lines.push(cardLine(id ? plan.items.get(id) : undefined, plan.types));
    }
    lines.push('');
  }
  return lines;
}
