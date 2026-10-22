// Deleting a Sheet with its sheet (docs/specs/029-sheets/sheet-store.md "Deleting a sheet", blueprint
// sheet-store.md "Deleting a sheet"). Before a delete, the guard finds the sheets it would take with it (those
// nothing else references, sheet-references.ts) and asks once for all of them. A delete taking no sheet, or one made
// before any Sheet has drawn (nothing attached to release them), goes ahead without asking: its sheets are then left
// as a Cut's are.
import { useCallback } from 'react';
import type { Tab } from '@livediagram/document';
import { sheetsDeletedWith } from '@/lib/sheet-references';
import { track } from '@/lib/telemetry';

type Confirm = (opts: {
  title: string;
  message: string;
  confirmLabel?: string;
}) => Promise<boolean>;

// Null: delete now, nothing to ask. A promise: the person's answer, null when they cancelled; `release` deletes the
// sheets, called once the elements are gone.
export type SheetDeleteGuard = (
  targetIds: ReadonlySet<string>,
) => Promise<{ release: () => void } | null> | null;

export function sheetDeleteCopy(titles: readonly string[]): { title: string; message: string } {
  if (titles.length === 1)
    return {
      title: 'Delete Sheet?',
      message: `${titles[0]} and its cells are deleted. Undo brings it back while this page is open.`,
    };
  return {
    title: `Delete ${titles.length} Sheets?`,
    message: `${titles.join(', ')} and their cells are deleted. Undo brings them back while this page is open.`,
  };
}

export function useSheetDeleteGuard(deps: {
  readTabs: () => readonly Tab[];
  activeTabId: string;
  confirm: Confirm;
  sheetsAttached: () => boolean;
  sheetTitle: (sheetId: string) => string | undefined;
  releaseSheets: (sheetIds: readonly string[]) => boolean;
}): SheetDeleteGuard {
  const { readTabs, activeTabId, confirm, sheetsAttached, sheetTitle, releaseSheets } = deps;
  return useCallback(
    (targetIds) => {
      if (!sheetsAttached()) return null;
      const ids = sheetsDeletedWith(readTabs(), activeTabId, targetIds);
      if (ids.length === 0) return null;
      const titles = ids.map((id) => sheetTitle(id) ?? 'Sheet');
      return confirm({ ...sheetDeleteCopy(titles), confirmLabel: 'Delete' }).then((ok) => {
        track('Sheet', 'Deleted', ok ? 'Confirmed' : 'Cancelled');
        return ok ? { release: () => void releaseSheets(ids) } : null;
      });
    },
    [readTabs, activeTabId, confirm, sheetsAttached, sheetTitle, releaseSheets],
  );
}
