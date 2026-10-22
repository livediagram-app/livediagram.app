// A form's responses sheet made on its new Sheet tab without opening the tab (docs/specs/030-forms/forms.md "Starting
// a form"): through the document's sheet store, once the tab's own save has landed (`whenTabSaved`), so the create
// never reaches the server ahead of its tab and comes back 404. The store still retries a `tab_not_found` should the
// wait run out. The store is the lazily loaded sheet chunk's, so it is fetched only when a sheet is made.
import { emptyLayout } from '@livedesign/sheets';
import type { SheetsBridge } from '@/hooks/sheets/useSheetsBridge';
import { whenTabSaved } from '@/lib/tab-saved';

export function makeFormSheet(
  bridge: SheetsBridge,
  create: { id: string; tabId: string; title: string },
): Promise<void> {
  return Promise.all([
    import('@/components/sheets/sheet-store-client'),
    whenTabSaved(bridge.scope.documentId, create.tabId),
  ]).then(([{ sheetStoreOf }]) => {
    sheetStoreOf(bridge).create({ ...create, layout: emptyLayout() });
  });
}
