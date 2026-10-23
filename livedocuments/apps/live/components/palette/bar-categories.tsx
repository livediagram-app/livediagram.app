'use client';

import { barLabel } from './category-flyout-groups';
import type { BarCategory } from './CategoryBar';

// What the category bar offers (docs/specs/007-editor/toolbar-layout.md "The category bar"): the mode's palette
// categories, in order, every name in one word.

/** The bar's categories for a mode's palette categories. */
export function barCategoriesFor(categories: readonly BarCategory[]): BarCategory[] {
  return categories.map((c) => ({ ...c, label: barLabel(c.id, c.label) }));
}
