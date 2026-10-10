'use client';

// Importing a tab's JSON export brings its Plan items with it (docs/specs/026-plan/items.md "Copies and exports"):
// the file's types its new cards use, then the cards the document does not already hold, each its own undo step.
// The tab's content lands first (useTabImport); this adds what its boards and cards draw from.
import {
  planTabItemsImport,
  type Item,
  type ItemTypeDef,
  type ItemWrite,
} from '@livediagram/items';
import type { ImportedPlanItems } from '@/lib/import-tab';
import { waitUntil } from '@/lib/wait-until';
import { useLatest } from '@/hooks/ui/useLatest';
import type { PlanItemsStatus } from './usePlanItems';
import { debugLog } from '@/lib/debug-log';

// How long an import waits for the item store (blueprint DEFAULTS): a document with no Plan content until the
// import starts loading it only once the imported board lands, which is a fetch away.
export const PLAN_IMPORT_READY_WAIT_MS = 10_000;

// What landed: the cards made, those the document already had, and those the store refused.
export type PlanTabImportResult = { added: number; skipped: number; failed: number };

export function usePlanTabImport(opts: {
  // Only a loaded store says which cards the document already holds: before it every card in the file would look
  // new and be made again. The import waits for it (the imported board is what starts the load); a store that
  // fails or never loads adds none, and the import says so.
  status: PlanItemsStatus;
  items: ReadonlyMap<string, Item>;
  types: readonly ItemTypeDef[];
  addTypes: (defs: readonly ItemTypeDef[]) => void;
  write: (write: ItemWrite) => Promise<boolean>;
  readyWaitMs?: number;
}): (plan: ImportedPlanItems) => Promise<PlanTabImportResult> {
  // Read at the moment of use, not when the file picker opened: the store loads and changes meanwhile.
  const latest = useLatest(opts);
  // A plain function (the React compiler memoises it): it reads the store through the ref when it runs.
  return (plan: ImportedPlanItems) => {
    async function run(): Promise<PlanTabImportResult> {
      const ready = await waitUntil(
        () => latest.current.status === 'ready',
        latest.current.readyWaitMs ?? PLAN_IMPORT_READY_WAIT_MS,
      );
      if (!ready) {
        debugLog('[plan-tab-import] store not ready', {
          status: latest.current.status,
          items: plan.items.length,
        });
        return { added: 0, skipped: 0, failed: plan.items.length };
      }
      const { items, types, addTypes, write } = latest.current;
      const {
        types: newTypes,
        creates,
        skipped,
      } = planTabItemsImport(plan.items, plan.itemTypes, items, types);
      if (newTypes.length > 0) addTypes(newTypes);
      const ok = creates.length === 0 || (await write({ kind: 'create', creates }));
      const result = { added: ok ? creates.length : 0, skipped, failed: ok ? 0 : creates.length };
      debugLog('[plan-tab-import]', { ...result, types: newTypes.length });
      return result;
    }
    return run();
  };
}
