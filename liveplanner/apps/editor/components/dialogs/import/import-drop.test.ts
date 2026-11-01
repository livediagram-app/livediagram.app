// Where a file dropped on the Import dialog goes (docs/specs/026-plan/plan-tabs.md "The Import dialog").
import { describe, expect, it } from 'vitest';
import {
  DROP_NOT_CSV,
  DROP_TAB_JSON_HERE,
  DROP_UNKNOWN,
  DROP_WANTS_CSV,
  DROP_WANTS_JSON,
  routeImportDrop,
} from './import-drop';
import type { IntoTab } from './into-tab';

const JSON_TAB: IntoTab = { kind: 'json' };
const CSV_TAB: IntoTab = { kind: 'csv', target: 'board', onPick: () => {}, onFile: () => {} };
const TAB_JSON = JSON.stringify({ schemaVersion: 2, kind: 'liveplanner.tab', tab: {} }, null, 2);
const TRELLO = JSON.stringify({
  name: 'Site',
  lists: [{ id: 'l1', name: 'To Do', pos: 1 }],
  cards: [{ id: 'c1', name: 'A', idList: 'l1' }],
});
const JIRA = 'Summary,Issue key,Status\nFix it,AB-1,To Do\n';

const to = (text: string, intoTab: IntoTab, tools: boolean) =>
  routeImportDrop(text, 'file', { intoTab, tools });

describe('routeImportDrop', () => {
  it('sends a liveplanner tab’s JSON to the tab that takes it, told by its first lines', () => {
    expect(to(TAB_JSON, JSON_TAB, true)).toEqual({ to: 'tab-json' });
    expect(to(TAB_JSON, JSON_TAB, false)).toEqual({ to: 'tab-json' });
    expect(to(TAB_JSON, CSV_TAB, true)).toEqual({ to: 'error', error: DROP_TAB_JSON_HERE });
    expect(to(TAB_JSON, { kind: 'json', blocked: 'Locked.' }, true)).toEqual({
      to: 'error',
      error: 'Locked.',
    });
  });

  it('reads another tool’s export whole, for an Editor, whatever the tab', () => {
    for (const tab of [JSON_TAB, CSV_TAB]) {
      const trello = to(TRELLO, tab, true);
      expect(trello.to === 'tracker' && trello.read.board.source).toBe('trello');
      const jira = to(JIRA, tab, true);
      expect(jira.to === 'tracker' && jira.read.board.source).toBe('jira');
    }
  });

  it('never reads a tool’s export for someone who may not import one', () => {
    expect(to(JIRA, CSV_TAB, false)).toEqual({ to: 'tab-csv' });
    expect(to(TRELLO, CSV_TAB, false)).toEqual({ to: 'error', error: DROP_WANTS_CSV });
    // With no tools to try, a Dashboard's own import says what is wrong with JSON it can't read.
    expect(to(TRELLO, JSON_TAB, false)).toEqual({ to: 'tab-json' });
    expect(to('{"a":1}', { kind: 'json', blocked: 'Locked.' }, false)).toEqual({
      to: 'error',
      error: 'Locked.',
    });
    expect(to(JIRA, JSON_TAB, false)).toEqual({ to: 'error', error: DROP_WANTS_JSON });
  });

  it('sends any other CSV into a Board or Sheet tab, unless it is locked', () => {
    expect(to('Title\nA\n', CSV_TAB, true)).toEqual({ to: 'tab-csv' });
    expect(to('Title\nA\n', { ...CSV_TAB, blocked: 'Locked.' }, true)).toEqual({
      to: 'error',
      error: 'Locked.',
    });
  });

  it('says why when nothing takes it', () => {
    expect(to('Title\nA\n', JSON_TAB, true)).toEqual({ to: 'error', error: DROP_UNKNOWN });
    expect(to('{"a":1}', JSON_TAB, true)).toEqual({ to: 'error', error: DROP_UNKNOWN });
    expect(to('{"a":1}', CSV_TAB, true)).toEqual({ to: 'error', error: DROP_NOT_CSV });
    expect(to('{"lists": [', JSON_TAB, true)).toEqual({
      to: 'error',
      error: "That file isn't valid JSON.",
    });
    expect(to('Summary,Issue key,Status\n', CSV_TAB, true)).toEqual({
      to: 'error',
      error: 'That file has no cards to import.',
    });
  });

  it('reads a tool’s CSV header from the first line alone, Windows line ends included', () => {
    expect(to('Summary,Issue key,Status\r\nFix,AB-1,Done\r\n', CSV_TAB, true).to).toBe('tracker');
    expect(to('Summary,Issue key,Status', CSV_TAB, true)).toEqual({
      to: 'error',
      error: 'That file has no cards to import.',
    });
  });
});
