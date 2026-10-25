// Filing one source's categories under a heading of the All view (the Account section, or an app): each category
// and row id is prefixed with the heading's, so two apps' "Editor" or "notifyComments" never collide in one
// dialog, and every reference between them (a sub-category's parent, a nested row's, a link's target, the power
// user readout's lines) is prefixed with it. A readout line whose row is drawn under another heading (an editor's
// common setting, under Common) is prefixed with that heading's (`groupOf`).
import type { SettingsCategory, SettingsRow } from './model';

export const groupedId = (group: string, id: string) => `${group}:${id}`;

function prefixRow(
  group: string,
  row: SettingsRow,
  groupOf: (rowKey: string) => string = () => group,
): SettingsRow {
  const key = groupedId(group, row.key);
  const parent = row.parent !== undefined ? { parent: groupedId(group, row.parent) } : {};
  switch (row.kind) {
    case 'link':
      return { ...row, key, ...parent, target: groupedId(group, row.target) };
    case 'presetSummary':
      return {
        ...row,
        key,
        ...parent,
        lines: row.lines.map((line) => ({
          ...line,
          rowKey: groupedId(groupOf(line.rowKey), line.rowKey),
          categoryId: groupedId(groupOf(line.rowKey), line.categoryId),
        })),
      };
    default:
      return { ...row, key, ...parent };
  }
}

export function groupCategories(
  group: string,
  categories: readonly SettingsCategory[],
  {
    omit,
    groupOf,
  }: { omit?: (row: SettingsRow) => boolean; groupOf?: (rowKey: string) => string } = {},
): SettingsCategory[] {
  const kept = categories
    .map((category) => ({
      category,
      rows: omit ? category.rows.filter((row) => !omit(row)) : category.rows,
    }))
    .filter(({ rows }) => rows.length > 0);
  const ids = new Set(kept.map(({ category }) => category.id));
  return kept.map(({ category: { parent, ...category }, rows }) => ({
    ...category,
    id: groupedId(group, category.id),
    group,
    // A sub-category whose parent was left out stands at the top level.
    ...(parent !== undefined && ids.has(parent) ? { parent: groupedId(group, parent) } : {}),
    rows: rows.map((row) => prefixRow(group, row, groupOf)),
  }));
}
