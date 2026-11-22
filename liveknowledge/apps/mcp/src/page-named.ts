// A page by its id or its title, among rows the tool already holds (list_pages' `under`, the page a rename or a
// delete names): the api's own rule (knowledge/page-read.ts `pageNamed`), so a title means the same page on every
// tool. A reference that names no page, or several, is a mistake the caller can fix, said with the pages there are.
import { ToolInputError } from './tool-helpers';

type NamedRow = { tab: string; title: string };

const titleKey = (title: string) => title.toLowerCase().replace(/\s+/g, ' ').trim();
/** How many pages a refusal names before it points at list_pages. */
const PAGES_NAMED = 12;

export function pageRowNamed<T extends NamedRow>(rows: readonly T[], ref: string): T {
  const byId = rows.find((r) => r.tab === ref);
  if (byId) return byId;
  const key = titleKey(ref);
  const titled = key ? rows.filter((r) => titleKey(r.title) === key) : [];
  if (titled.length === 1) return titled[0]!;
  if (titled.length > 1)
    throw new ToolInputError(
      `${titled.length} pages are titled "${ref}": name one by its id (${titled.map((r) => r.tab).join(', ')}).`,
    );
  const some = rows.slice(0, PAGES_NAMED).map((r) => `"${r.title}" (${r.tab})`);
  const more =
    rows.length > PAGES_NAMED
      ? `, and ${rows.length - PAGES_NAMED} more (list_pages lists them)`
      : '';
  throw new ToolInputError(
    `No page "${ref}" in this knowledgebase. Pages: ${some.join(', ')}${more}.`,
  );
}
