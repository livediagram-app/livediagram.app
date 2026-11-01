'use client';

// Each drawn board's CSV actions, by element id, for its Board tab's tab menu (docs/specs/026-plan/plan-tabs.md
// "Board tab and Sheet tab"): the menu sits outside the board's Plan context, so the board publishes what Import
// CSV… does and its cards' CSV, kept current as it renders, as a Sheet publishes its settings.
import { useLayoutEffect } from 'react';

type BoardCsvEntry = {
  // Whether this person may add cards here (an Editor or a Participant, not on an Archive board).
  canImport: boolean;
  onImportCsv: () => void;
  // A file already in hand (one dropped on the Import dialog), read as Import CSV reads a picked one.
  onImportCsvFile: (file: File) => void;
  // The board's cards as CSV text, for the Export dialog's CSV (docs/specs/026-plan/plan-tabs.md "Export").
  csvText: () => string;
};

const entries = new Map<string, BoardCsvEntry>();

// A drawn board publishes its entry each render, and takes it back when it goes.
export function usePublishBoardCsv(elementId: string, entry: BoardCsvEntry | undefined): void {
  useLayoutEffect(() => {
    if (entry) entries.set(elementId, entry);
    else entries.delete(elementId);
  });
  useLayoutEffect(
    () => () => {
      entries.delete(elementId);
    },
    [elementId],
  );
}

// The entry now, outside React: read as the tab menu draws and again at the press.
export function boardCsvEntryOf(elementId: string): BoardCsvEntry | undefined {
  return entries.get(elementId);
}
