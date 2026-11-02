// Reading another tool's export (docs/specs/026-plan/tracker-import.md "Reading the file"): the source is read from
// the file itself (a Trello board's JSON shape, or a CSV's header row), then its reader makes the TrackerBoard. The
// CSV text is split into rows by the caller's reader (the Sheet's parseCsv), as this package imports no other.
import { PLAN_TITLE_MAX } from '../limits';
import { isAsanaHeader, readAsanaRows } from './asana';
import { isJiraHeader, readJiraRows } from './jira';
import { isLinearHeader, readLinearRows } from './linear';
import type { Row } from './tracker-columns';
import { TRACKER_CARDS_MAX, type TrackerBoard } from './tracker-model';
import { cleanText } from './tracker-text';
import { isTrelloBoard, readTrelloBoard } from './trello';

// The title a board gets when neither the file nor its name gives one.
export const TRACKER_UNTITLED = 'Imported Board';

export type TrackerRefusal = {
  refusal: 'not_json' | 'unknown_source' | 'too_many_cards' | 'no_cards';
  // The file's cards, for too_many_cards.
  count?: number;
};

export function isTrackerRefusal(v: TrackerBoard | TrackerRefusal): v is TrackerRefusal {
  return 'refusal' in v;
}

// The spec's sentence for each refusal.
export function trackerRefusalMessage(r: TrackerRefusal): string {
  switch (r.refusal) {
    case 'not_json':
      return "That file isn't valid JSON.";
    case 'unknown_source':
      return "This file isn't a Trello, Asana, Jira or Linear export.";
    case 'no_cards':
      return 'That file has no cards to import.';
    case 'too_many_cards':
      return `That file has ${(r.count ?? 0).toLocaleString('en-GB')} cards. A plan holds up to ${TRACKER_CARDS_MAX.toLocaleString('en-GB')}.`;
  }
}

function titleOf(board: TrackerBoard, fileName: string | undefined): string {
  if (board.title) return board.title;
  const base = cleanText((fileName ?? '').replace(/\.[^./\\]+$/, ''), PLAN_TITLE_MAX);
  return base || TRACKER_UNTITLED;
}

function readBoard(
  text: string,
  parseRows: (text: string) => readonly Row[],
): TrackerBoard | TrackerRefusal {
  if (text.trimStart().startsWith('{')) {
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      return { refusal: 'not_json' };
    }
    return isTrelloBoard(json) ? readTrelloBoard(json) : { refusal: 'unknown_source' };
  }
  const rows = parseRows(text);
  const header = rows[0];
  if (isJiraHeader(header)) return readJiraRows(rows);
  if (isAsanaHeader(header)) return readAsanaRows(rows);
  if (isLinearHeader(header)) return readLinearRows(rows);
  return { refusal: 'unknown_source' };
}

// A file's text as the board it describes, or why it cannot be imported.
export function readTrackerFile(
  text: string,
  parseRows: (text: string) => readonly Row[],
  fileName?: string,
): TrackerBoard | TrackerRefusal {
  const board = readBoard(text, parseRows);
  if (isTrackerRefusal(board)) return board;
  if (board.cards.length === 0) return { refusal: 'no_cards' };
  if (board.cards.length > TRACKER_CARDS_MAX)
    return { refusal: 'too_many_cards', count: board.cards.length };
  return { ...board, title: titleOf(board, fileName) };
}
