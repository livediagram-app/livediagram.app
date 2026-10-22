// Which sheets a delete takes with its elements (docs/specs/029-sheets/sheet-store.md "Deleting a sheet"): those of
// the deleted Sheet elements that nothing else in the document references, on any tab, as a Sheet (`sheetId`) or as
// a copy not yet made (`copyOf`). A deleted copy not yet made has no sheet of its own, so it takes nothing. The api
// keeps the same index (apps/api/src/db/sheet-refs.ts) and never deletes a sheet still referenced, so this decides
// only whether to ask.
import type { Element, Tab } from '@livediagram/document';

type SheetRef = { sheetId: string; copyOf?: string };

function sheetRefOf(el: Element): SheetRef | null {
  if (el.type !== 'shape' || el.shape !== 'plan-sheet') return null;
  return el.planSheet?.sheetId ? el.planSheet : null;
}

export function sheetsDeletedWith(
  tabs: readonly Tab[],
  activeTabId: string,
  targetIds: ReadonlySet<string>,
): string[] {
  const active = tabs.find((t) => t.id === activeTabId);
  const candidates = new Set<string>();
  for (const el of active?.elements ?? []) {
    if (!targetIds.has(el.id)) continue;
    const ref = sheetRefOf(el);
    if (ref && !ref.copyOf) candidates.add(ref.sheetId);
  }
  if (candidates.size === 0) return [];
  for (const tab of tabs) {
    for (const el of tab.elements) {
      if (tab.id === activeTabId && targetIds.has(el.id)) continue;
      const ref = sheetRefOf(el);
      if (!ref) continue;
      candidates.delete(ref.sheetId);
      if (ref.copyOf) candidates.delete(ref.copyOf);
    }
  }
  return [...candidates];
}
