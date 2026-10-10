// Renaming a sheet (docs/specs/029-sheets/sheet.md "Header"): trimmed, unchanged or empty does nothing, and a title
// another sheet on the tab has (any case) is refused with a toast. From the header's title and the Sheet's settings.
import type { SheetController } from './sheet-controller';

const TITLE_TAKEN = 'Another sheet on this tab is called that';

// Whether the sheet now has the title (true for an unchanged one).
export function renameSheet(c: SheetController, title: string): boolean {
  const t = title.trim();
  if (!t) return false;
  if (t === c.sheet.title) return true;
  const lower = t.toLowerCase();
  if (
    c.store.titlesOn(c.sheet.tabId).some((x) => x.toLowerCase() === lower && x !== c.sheet.title)
  ) {
    c.toast(TITLE_TAKEN);
    return false;
  }
  return c.write({ kind: 'title', title: t }, 'Title');
}
