// Rows from several apps in one category, laid out by section (liveworkspace/docs/specs/010-site/site.md "Settings", "Inside a
// merged category" and "Order inside a category"): each section once, holding every app's rows filed under that name
// in the order they came, so two apps' "Offer Again" are one section rather than the same heading twice. The sections
// SECTION_ORDER lists take its order among the places they hold (Editor reads Canvas, Mouse, Draw, Pages, Logo Pages
// whichever source brought Pages first); any other section stays where its first row came. The rows with no section
// lead: a category's own broadest settings (Panel Opacity, every panel's, above the panels' sections, though Common
// brings those first). Inside a section a row that closes it (`closesSection`: Tips and Check-Ins, Milestones) stays
// after the rows the apps add. Linear in rows (only the few section names are sorted).
import { sectionRank } from '@liveworkspace/settings/sections';
import type { SettingsRow } from './model';

type Ordered = Pick<SettingsRow, 'section' | 'closesSection'>;

const closingLast = <R extends Ordered>(rows: R[]): R[] =>
  rows.some((row) => row.closesSection)
    ? [...rows.filter((row) => !row.closesSection), ...rows.filter((row) => row.closesSection)]
    : rows;

export function bySection<R extends Ordered>(rows: readonly R[]): R[] {
  const groups = new Map<string, R[]>();
  for (const row of rows) {
    // A row with no section and one with an empty name read the same: no heading.
    const key = row.section ?? '';
    const group = groups.get(key);
    if (group) group.push(row);
    else groups.set(key, [row]);
  }
  // The rows with no heading first, then the sections.
  const sections = [...groups.keys()].sort((a, b) => Number(a !== '') - Number(b !== ''));
  // The listed sections, sorted into the places the listed ones hold.
  const listed = sections.filter((section) => sectionRank(section) >= 0);
  if (listed.length > 1) {
    const sorted = [...listed].sort((a, b) => sectionRank(a) - sectionRank(b));
    let next = 0;
    for (let i = 0; i < sections.length; i++) {
      if (sectionRank(sections[i]) >= 0) sections[i] = sorted[next++]!;
    }
  }
  return sections.flatMap((section) => closingLast(groups.get(section)!));
}
