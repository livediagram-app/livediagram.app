// Renaming a sheet (docs/specs/029-sheets/sheet.md "Header"): trimmed, unchanged or empty does nothing, and a title
// another sheet on the tab has (any case) is refused with a toast. From the header's title and the Sheet's settings.
import { uniqueSheetTitle } from '@livediagram/sheets';
import type { SheetController } from './sheet-controller';
import type { SheetStore } from './sheet-store-client';

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

// A tab renamed away from its default name (lib/tab-named-plan.ts): each of `sheetIds` still titled `from` takes
// `to`, kept unique among the tab's other sheets. A sheet not loaded yet keeps its title.
export function retitleSheets(
  store: Pick<SheetStore, 'sheet' | 'titlesOn' | 'write'>,
  sheetIds: readonly string[],
  from: string,
  to: string,
): void {
  for (const id of sheetIds) {
    const sheet = store.sheet(id);
    if (!sheet || sheet.title !== from) continue;
    const others = store.titlesOn(sheet.tabId).filter((t) => t !== sheet.title);
    store.write(id, { kind: 'title', title: uniqueSheetTitle(to, others) });
  }
}
