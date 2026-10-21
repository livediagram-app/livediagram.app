'use client';

// A board's Download CSV and Import CSV… (docs/specs/026-plan/plan-board.md "CSV"): the rows come from
// @livediagram/items (board-csv.ts), the CSV text from the Sheet's reader and writer, and the board publishes both
// actions for its Board tab's tab menu (board-csv-registry.ts).
import {
  ITEMS_MAX,
  boardCsvImport,
  boardCsvMessage,
  boardCsvRows,
  boardTakesCsv,
  type PlanBoardSetup,
} from '@livediagram/items';
import { parseCsv, toCsv } from '@livediagram/sheets';
import { usePlan, type PlanContextValue } from '@/components/plan/PlanContext';
import { usePublishBoardCsv } from '@/components/plan/board-csv-registry';
import { useLatest } from '@/hooks/ui/useLatest';
import { debugLog } from '@/lib/debug-log';
import { track } from '@/lib/telemetry';

// The file picker's filter: what Import CSV… reads.
export const BOARD_CSV_ACCEPT = '.csv,.tsv,text/csv,text/tab-separated-values';
// What the board says when the cards could not be written.
export const BOARD_CSV_FAILED = 'Couldn’t add the cards';
// The largest file Import CSV reads (plan-board.md "CSV"): the CSV reader's 10,000 rows at about 500 bytes each. A
// larger file is refused before it is read.
export const BOARD_CSV_MAX_BYTES = 5 * 1024 * 1024;
export const BOARD_CSV_TOO_BIG =
  'That file is too big to import. Import CSV reads files up to 5 MB.';

type Plan = Pick<PlanContextValue, 'items' | 'types' | 'statusNames'>;

export function boardCsvText(plan: Plan, setup: PlanBoardSetup): string {
  // A download: no field runs as a formula in the spreadsheet that opens it (sheet.md "CSV").
  return toCsv(boardCsvRows(setup, plan.items, plan.types, plan.statusNames), { safe: true });
}

// Reads a file's text into new cards on the board as one write; answers what the board then says.
export async function importBoardCsv(
  plan: Plan & Pick<PlanContextValue, 'people' | 'addItems'>,
  setup: PlanBoardSetup,
  text: string,
): Promise<string> {
  track('Plan', 'Imported', 'Csv');
  const result = boardCsvImport(parseCsv(text).rows, {
    setup,
    types: plan.types,
    statusNames: plan.statusNames,
    people: plan.people,
    room: Math.max(0, ITEMS_MAX - plan.items.size),
  });
  const ok = !!plan.addItems && (await plan.addItems(result.creates));
  debugLog('[board-csv] import', {
    creates: result.creates.length,
    skipped: result.skipped,
    refusal: result.refusal,
    ok,
  });
  if (!ok) return BOARD_CSV_FAILED;
  return boardCsvMessage({ ...result, added: result.creates.length });
}

// Publishes the board's CSV actions; nothing outside the editor (no Plan context) or before the board is set up.
export function useBoardCsv(elementId: string, setup: PlanBoardSetup | null): void {
  const plan = usePlan();
  const latest = useLatest({ plan, setup });
  usePublishBoardCsv(
    elementId,
    plan && setup
      ? {
          canImport: plan.canEditCards && !!plan.addItems && boardTakesCsv(setup),
          csvText: () => {
            const { plan: p, setup: s } = latest.current;
            return p && s ? boardCsvText(p, s) : '';
          },
          onImportCsv: () => {
            void (async () => {
              // Loaded at the press: the picker is the import dialog's, not needed to draw a board.
              const { pickTabFile } = await import('@/lib/import-tab');
              const file = await pickTabFile(BOARD_CSV_ACCEPT, { maxBytes: BOARD_CSV_MAX_BYTES });
              const { plan: p, setup: s } = latest.current;
              if (!file || !p || !s) return;
              const message = file.tooBig
                ? BOARD_CSV_TOO_BIG
                : await importBoardCsv(p, s, file.text);
              p.announce(message);
              p.notify?.(message);
            })();
          },
        }
      : undefined,
  );
}
