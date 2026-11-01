// Reading another tool's export in the Import dialog (docs/specs/026-plan/tracker-import.md "Reading the file"): the
// size checked before anything is read, then the text read as a board by @liveplanner/items, its CSV split by the
// Sheet's reader. Every refusal is the spec's sentence. Loaded with the dialog, never with the editor.
import {
  isTrackerRefusal,
  readTrackerFile,
  trackerRefusalMessage,
  type TrackerBoard,
  type TrackerRefusal,
} from '@liveplanner/items';
import { parseCsv } from '@liveplanner/sheets';

// What the picker offers: a Trello board's JSON, a CSV (or a tab-separated export).
export const TRACKER_FILE_ACCEPT =
  '.json,.csv,.tsv,application/json,text/csv,text/tab-separated-values';

export const TRACKER_TOO_BIG = 'That file is too big to import. Imports read files up to 20 MB.';

export type TrackerFileRead =
  { board: TrackerBoard } | { error: string; refusal?: TrackerRefusal['refusal'] };

// The text of a file named `name` as a board, or the sentence saying why it can't be imported (and the refusal, so
// the Import dialog can tell "no tool's export" from a tool's export it can't take).
export function readTrackerText(text: string, name: string): TrackerFileRead {
  const board = readTrackerFile(text, (t) => parseCsv(t).rows, name);
  return isTrackerRefusal(board)
    ? { error: trackerRefusalMessage(board), refusal: board.refusal }
    : { board };
}

// Whether a CSV's header row is a tool's, read from its first line alone: the full file is read only when it is.
// A header a tool's reader knows reads as a file with no cards; anything else as no tool's.
export function isTrackerCsvHead(text: string): boolean {
  const end = text.indexOf('\n');
  const head = end === -1 ? text : text.slice(0, end);
  const read = readTrackerFile(head, (t) => parseCsv(t).rows);
  return isTrackerRefusal(read) ? read.refusal !== 'unknown_source' : true;
}
