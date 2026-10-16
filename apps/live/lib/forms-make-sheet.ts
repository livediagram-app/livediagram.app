// A form's responses sheet made on its new Sheet tab without opening the tab (docs/specs/030-forms/forms.md "Starting
// a form"): through the document's sheet store, which retries while the tab is still being saved. The store is the
// lazily loaded sheet chunk's, so it is fetched only when a sheet is made.
import { emptyLayout } from '@livediagram/sheets';
import type { SheetsBridge } from '@/hooks/sheets/useSheetsBridge';

export function makeFormSheet(
  bridge: SheetsBridge,
  create: { id: string; tabId: string; title: string },
): void {
  void import('@/components/sheets/sheet-store-client').then(({ sheetStoreOf }) =>
    sheetStoreOf(bridge).create({ ...create, layout: emptyLayout() }),
  );
}
