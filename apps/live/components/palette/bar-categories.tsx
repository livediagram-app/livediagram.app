'use client';

import type { ReactNode } from 'react';
import { DrawTabIcon } from './palette-tab-icons';
import { barLabel } from './category-flyout-groups';
import { withSessionCategory } from './session-category';
import type { BarCategory } from './CategoryBar';

// What the category bar offers (docs/specs/007-editor/toolbar-layout.md "The category bar"), from the mode's palette
// categories: no Popular (every category is one press away, so a pick from across them adds nothing), every name in
// one word, Write and Draw as one category, and Facilitate's session tools gathered into Session.

export const WRITE_DRAW_ID = 'write-draw';

/** Write and Draw as one category, where Write stood: words and pens are reached for together, and two buttons for
 *  them crowded the bar. Its flyout keeps them apart as two headed sections, so neither is lost in the other. */
function withWriteAndDraw(categories: readonly BarCategory[]): BarCategory[] {
  const write = categories.find((c) => c.id === 'write');
  const draw = categories.find((c) => c.id === 'draw');
  if (!write?.tiles || !draw?.tiles) return [...categories];
  const merged: BarCategory = {
    id: WRITE_DRAW_ID,
    label: 'Draw',
    description: 'Words, notes, pens and connectors.',
    icon: <DrawTabIcon />,
    group: write.group,
    tiles: [...write.tiles, ...draw.tiles],
    content: null,
    sections: [
      { id: 'write', title: 'Write', tiles: [...write.tiles] },
      { id: 'draw', title: 'Draw', tiles: [...draw.tiles] },
    ],
  };
  const out: BarCategory[] = [];
  for (const c of categories) {
    if (c === write) out.push(merged);
    else if (c !== draw) out.push(c);
  }
  return out;
}

/** The bar's categories for a mode's palette categories. `sessionBody` draws Session's browse. */
export function barCategoriesFor(
  categories: readonly BarCategory[],
  sessionBody: (groups: readonly BarCategory[]) => ReactNode,
): BarCategory[] {
  const named = categories
    .filter((c) => c.id !== 'popular')
    .map((c) => ({ ...c, label: barLabel(c.id, c.label) }));
  return withSessionCategory(withWriteAndDraw(named), sessionBody);
}
