'use client';

import { barLabel } from './category-flyout-groups';
import type { BarCategory } from './CategoryBar';

// What the category bar offers (docs/specs/007-editor/toolbar-layout.md "The category bar"), from the mode's palette
// categories: no Popular (every category is one press away, so a pick from across them adds nothing), and every name
// in one word.

/** The bar's categories for a mode's palette categories. */
export function barCategoriesFor(categories: readonly BarCategory[]): BarCategory[] {
  return categories
    .filter((c) => c.id !== 'popular')
    .map((c) => ({ ...c, label: barLabel(c.id, c.label) }));
}
