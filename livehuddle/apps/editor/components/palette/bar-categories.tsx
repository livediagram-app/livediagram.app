'use client';

import { barLabel } from './category-flyout-groups';
import type { BarCategory } from './CategoryBar';

// What the category bar offers (docs/specs/007-editor/toolbar-layout.md "The category bar"), from the meeting
// palette's categories: no Popular (every category is one press away, so a pick from across them adds nothing), and
// every name in one word. Each category is the bar's own: there is no Session category gathering some of them
// (docs/specs/012-collaboration/workshop-mode.md "The palette").

/** The bar's categories for the palette's categories. */
export function barCategoriesFor(categories: readonly BarCategory[]): BarCategory[] {
  return categories
    .filter((c) => c.id !== 'popular')
    .map((c) => ({ ...c, label: barLabel(c.id, c.label) }));
}
