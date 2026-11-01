// Reading another tool's export in the Import dialog (docs/specs/026-plan/tracker-import.md "Reading the file"): the
// size checked before anything is read, then the text read as a board by @liveplanner/items, its CSV split by the
// Sheet's reader. Every refusal is the spec's sentence. Loaded with the dialog, never with the editor.
import {
  TRACKER_FILE_MAX_BYTES,
  isTrackerRefusal,
  readTrackerFile,
  trackerRefusalMessage,
  type TrackerBoard,
} from '@liveplanner/items';
import { parseCsv } from '@liveplanner/sheets';

// What the picker offers: a Trello board's JSON, a CSV (or a tab-separated export).
export const TRACKER_FILE_ACCEPT =
  '.json,.csv,.tsv,application/json,text/csv,text/tab-separated-values';

export const TRACKER_TOO_BIG = 'That file is too big to import. Imports read files up to 20 MB.';

export type TrackerFileRead = { board: TrackerBoard } | { error: string };

// The text of a file named `name` as a board, or the sentence saying why it can't be imported.
export function readTrackerText(text: string, name: string): TrackerFileRead {
  const board = readTrackerFile(text, (t) => parseCsv(t).rows, name);
  return isTrackerRefusal(board) ? { error: trackerRefusalMessage(board) } : { board };
}

// A dropped file: refused unread past the cap, as the picker's is.
export async function readTrackerDrop(file: File): Promise<TrackerFileRead> {
  if (file.size > TRACKER_FILE_MAX_BYTES) return { error: TRACKER_TOO_BIG };
  return readTrackerText(await file.text(), file.name);
}
