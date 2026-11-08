// Filing one source's categories under its id in the panel (the account, Common, or an app): each category
// and row id is prefixed with the source's, so two apps' "Editor" or "notifyComments" never collide in one
// dialog, and every reference between them (a sub-category's parent, a nested row's) is prefixed with it.
import type { SettingsCategory, SettingsRow } from './model';

export const groupedId = (group: string, id: string) => `${group}:${id}`;

function prefixRow(group: string, row: SettingsRow): SettingsRow {
  const key = groupedId(group, row.key);
  const parent = row.parent !== undefined ? { parent: groupedId(group, row.parent) } : {};
  return { ...row, key, ...parent };
}

export function groupCategories(
  group: string,
  categories: readonly SettingsCategory[],
  {
    omit,
    keepEmpty = false,
  }: {
    omit?: (row: SettingsRow) => boolean;
    // Keeps a category left with no rows, so the All view's merge still knows where its sub-categories sit.
    keepEmpty?: boolean;
  } = {},
): SettingsCategory[] {
  const kept = categories
    .map((category) => ({
      category,
      rows: omit ? category.rows.filter((row) => !omit(row)) : category.rows,
    }))
    .filter(({ rows }) => keepEmpty || rows.length > 0);
  const ids = new Set(kept.map(({ category }) => category.id));
  return kept.map(({ category: { parent, ...category }, rows }) => ({
    ...category,
    id: groupedId(group, category.id),
    group,
    // A sub-category whose parent was left out stands at the top level.
    ...(parent !== undefined && ids.has(parent) ? { parent: groupedId(group, parent) } : {}),
    rows: rows.map((row) => prefixRow(group, row)),
  }));
}
