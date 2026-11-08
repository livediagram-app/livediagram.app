// Rows from several apps in one category, laid out by section (liveworkspace/docs/specs/010-site/site.md "Settings", "Inside a
// merged category"): each section once, where it first appears, holding every app's rows filed under that name in the
// order they came, so two apps' "Offer Again" are one section rather than the same heading twice. Rows with no section
// are one group too, where the first of them came. Linear in rows.
import type { SettingsRow } from './model';

export function bySection<R extends Pick<SettingsRow, 'section'>>(rows: readonly R[]): R[] {
  const groups = new Map<string, R[]>();
  for (const row of rows) {
    // A row with no section and one with an empty name read the same: no heading.
    const key = row.section ?? '';
    const group = groups.get(key);
    if (group) group.push(row);
    else groups.set(key, [row]);
  }
  if (groups.size <= 1) return [...rows];
  return [...groups.values()].flat();
}
