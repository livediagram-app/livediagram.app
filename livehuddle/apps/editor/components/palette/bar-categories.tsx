'use client';

import type { ReactNode } from 'react';
import { barLabel } from './category-flyout-groups';
import { withSessionCategory } from './session-category';
import type { BarCategory } from './CategoryBar';

// What the category bar offers (docs/specs/007-editor/toolbar-layout.md "The category bar"), from the mode's palette
// categories: no Popular (every category is one press away, so a pick from across them adds nothing), every name in
// one word, and Workshop's session tools gathered into Session.

/** The bar's categories for a mode's palette categories. `sessionBody` draws Session's browse. */
export function barCategoriesFor(
  categories: readonly BarCategory[],
  sessionBody: (groups: readonly BarCategory[]) => ReactNode,
): BarCategory[] {
  const named = categories
    .filter((c) => c.id !== 'popular')
    .map((c) => ({ ...c, label: barLabel(c.id, c.label) }));
  return withSessionCategory(named, sessionBody);
}
