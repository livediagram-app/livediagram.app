// @vitest-environment jsdom

// The one Import dialog (docs/specs/026-plan/plan-tabs.md "The Import dialog"): its list (Into This Tab, then A Board
// from Another Tool for an Editor), the liveplanner Tab step (a clean import closes, one that left something out shows
// the report), a Board or Sheet tab's CSV, and where a dropped file goes. The tools' preview and import are
// tracker-import/TrackerImportPanel.test.tsx's.

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TRACKER_FILE_MAX_BYTES } from '@liveplanner/items';
import type { ImportOutcome } from '@/lib/import-tab';
import { ImportTabDialog } from './ImportTabDialog';
import type { IntoTab } from './import/into-tab';
import {
  DROP_NOT_CSV,
  DROP_TAB_JSON_HERE,
  DROP_UNKNOWN,
  DROP_WANTS_CSV,
} from './import/import-drop';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

// A session that may not import from another tool (a Participant or a Viewer): no tool section.
const NO_TRACKER = { canImport: false, contextFor: vi.fn(), importPlan: vi.fn() };
const EDITOR = { canImport: true, contextFor: vi.fn(async () => null), importPlan: vi.fn() };
const JSON_TAB: IntoTab = { kind: 'json' };
const csvTab = (over: Partial<Extract<IntoTab, { kind: 'csv' }>> = {}) =>
  ({ kind: 'csv', target: 'board', onPick: vi.fn(), onFile: vi.fn(), ...over }) as Extract<
    IntoTab,
    { kind: 'csv' }
  >;

const TAB_JSON = '{\n  "schemaVersion": 2,\n  "kind": "liveplanner.tab",\n  "tab": {}\n}';

function open({
  intoTab = JSON_TAB,
  tracker = EDITOR,
  outcome = { status: 'done' },
}: {
  intoTab?: IntoTab;
  tracker?: typeof EDITOR | typeof NO_TRACKER;
  outcome?: ImportOutcome;
} = {}) {
  const onClose = vi.fn();
  const onImportText = vi.fn(async () => outcome);
  render(
    <ImportTabDialog
      tabName="Overview"
      intoTab={intoTab}
      onImportFile={vi.fn(async () => outcome)}
      onImportText={onImportText}
      tracker={tracker}
      onClose={onClose}
    />,
  );
  return { onClose, onImportText };
}

const list = () => screen.getByTestId('import-choose');
const drop = (file: File) =>
  fireEvent.drop(list(), { dataTransfer: { types: ['Files'], files: [file] } });
const rowNames = (group: string) =>
  within(screen.getByRole('group', { name: group }))
    .getAllByRole('button')
    .map((b) => b.getAttribute('data-option'));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('ImportTabDialog: the list', () => {
  it('offers the tab’s own import, then the four tools, each with what file to bring', () => {
    open();
    expect(screen.getByRole('heading', { name: 'Import' })).toBeTruthy();
    expect(rowNames('Into This Tab')).toEqual(['into']);
    expect(rowNames('A Board from Another Tool')).toEqual(['trello', 'asana', 'jira', 'linear']);
    const trello = screen.getByRole('button', { name: /^Trello: / });
    expect(trello.textContent).toContain('Export as JSON');
    expect(trello.textContent).toContain('JSON');
    expect(screen.getByRole('button', { name: /^Jira: / }).textContent).toContain(
      'Export CSV (all fields)',
    );
    expect(screen.getByRole('button', { name: /^liveplanner Tab: / }).textContent).toContain(
      'Replaces this tab',
    );
  });

  it('has one row in the Tab order per section, the arrow keys moving through the tools', () => {
    open();
    const tools = within(
      screen.getByRole('group', { name: 'A Board from Another Tool' }),
    ).getAllByRole('button');
    expect(tools.map((b) => b.tabIndex)).toEqual([0, -1, -1, -1]);
    tools[0]!.focus();
    fireEvent.keyDown(tools[0]!, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(tools[1]);
    fireEvent.keyDown(tools[1]!, { key: 'End' });
    expect(document.activeElement).toBe(tools[3]);
  });

  it('shows no tool section to a Participant or a Viewer', () => {
    open({ intoTab: csvTab(), tracker: NO_TRACKER });
    expect(screen.queryByRole('group', { name: 'A Board from Another Tool' })).toBeNull();
    expect(rowNames('Into This Tab')).toEqual(['into']);
  });

  it('opens straight at the paste step when the liveplanner Tab is all it offers', () => {
    open({ tracker: NO_TRACKER });
    expect(screen.getByText('Paste your JSON, or import a file.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /All Imports/ })).toBeNull();
  });

  it('dims the tab’s own row with its reason, keeping the tools', () => {
    open({
      intoTab: { kind: 'json', blocked: 'This tab is locked. Unlock it to import into it.' },
    });
    expect(screen.getByRole('button', { name: /^liveplanner Tab: / })).toHaveProperty(
      'disabled',
      true,
    );
    expect(screen.getByText('This tab is locked. Unlock it to import into it.')).toBeTruthy();
    expect(rowNames('A Board from Another Tool')).toHaveLength(4);
  });

  it('shows the list, the row dimmed, when nothing in it can be pressed', () => {
    open({ intoTab: { kind: 'json', blocked: 'Locked.' }, tracker: NO_TRACKER });
    expect(screen.getByText('Locked.')).toBeTruthy();
    expect(screen.queryByText('Paste your JSON, or import a file.')).toBeNull();
  });
});

describe('ImportTabDialog: a liveplanner Tab', () => {
  it('opens the paste step under a back bar, passes the pasted JSON on and closes', async () => {
    const { onImportText, onClose } = open();
    fireEvent.click(screen.getByRole('button', { name: /^liveplanner Tab: / }));
    expect(screen.getByRole('heading', { name: 'Import to Tab' })).toBeTruthy();
    expect(screen.getByText(/This replaces everything on/).textContent).toContain('Overview');
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '{}' } });
    fireEvent.click(screen.getByRole('button', { name: 'Import' }));
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(onImportText).toHaveBeenCalledWith('{}');
  });

  it('goes back to the list from the back bar', () => {
    open();
    fireEvent.click(screen.getByRole('button', { name: /^liveplanner Tab: / }));
    fireEvent.click(screen.getByRole('button', { name: /All Imports/ }));
    expect(screen.getByTestId('import-choose')).toBeTruthy();
  });

  it("reports a JSON import's refused Plan cards (docs/specs/026-plan/items.md)", async () => {
    const { onClose } = open({
      tracker: NO_TRACKER,
      outcome: {
        status: 'done',
        failures: [{ title: 'Plan Cards', message: "2 cards couldn't be added to this project." }],
      },
    });
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '{}' } });
    fireEvent.click(screen.getByRole('button', { name: 'Import' }));
    expect((await screen.findByTestId('import-report')).textContent).toContain(
      "2 cards couldn't be added",
    );
    expect(screen.getByText("Here's how your import came across.")).toBeTruthy();
    expect(screen.queryByText(/This replaces everything/)).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('names Undo’s keys only on a fine pointer', () => {
    open({ tracker: NO_TRACKER });
    const keys = screen.getByText(/⌘Z/);
    expect(keys.className).toContain('pointer-coarse:hidden');
    expect(keys.parentElement!.textContent).toMatch(/Undo \(⌘Z \/ Ctrl.Z\) brings it back\./);
  });
});

describe('ImportTabDialog: a Board or Sheet tab’s CSV', () => {
  it('hands the press to the tab’s own picker and closes', () => {
    const into = csvTab();
    const { onClose } = open({ intoTab: into });
    const row = screen.getByRole('button', { name: /^CSV: / });
    expect(row.textContent).toContain('each row a new card on this board');
    fireEvent.click(row);
    expect(into.onPick).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('says a Sheet’s CSV fills its cells, and dims the row with its reason', () => {
    open({ intoTab: csvTab({ target: 'sheet', blocked: 'Only someone who may change it.' }) });
    const row = screen.getByRole('button', { name: /^CSV: / });
    expect(row.textContent).toContain('into this sheet’s cells');
    expect(row).toHaveProperty('disabled', true);
    fireEvent.click(row);
    expect(screen.getByText('Only someone who may change it.')).toBeTruthy();
  });
});

describe('ImportTabDialog: a dropped file', () => {
  it('outlines the list while a file is dragged over it, and nothing else', () => {
    open();
    fireEvent.dragEnter(list(), { dataTransfer: { types: ['text/plain'] } });
    expect(screen.queryByText('Drop to Import')).toBeNull();
    fireEvent.dragEnter(list(), { dataTransfer: { types: ['Files'] } });
    fireEvent.dragEnter(list(), { dataTransfer: { types: ['Files'] } });
    fireEvent.dragOver(list(), { dataTransfer: { types: ['Files'] } });
    expect(screen.getByText('Drop to Import')).toBeTruthy();
    // Leaving a row for the list keeps the outline: only the last leave clears it.
    fireEvent.dragLeave(list());
    expect(screen.getByText('Drop to Import')).toBeTruthy();
    fireEvent.dragLeave(list());
    expect(screen.queryByText('Drop to Import')).toBeNull();
  });

  it('puts a liveplanner tab’s JSON in the paste box, to import with a press', async () => {
    open();
    drop(new File([TAB_JSON], 'overview.liveplanner-tab.json'));
    expect(await screen.findByText('Paste your JSON, or import a file.')).toBeTruthy();
    expect(screen.getByRole('textbox')).toHaveProperty('value', TAB_JSON);
  });

  it('reads a plain CSV into a Board tab, and closes', async () => {
    const into = csvTab();
    const { onClose } = open({ intoTab: into });
    const file = new File(['Title\nA\n'], 'cards.csv');
    drop(file);
    await waitFor(() => expect(into.onFile).toHaveBeenCalledWith(file));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('refuses a file past the cap unread, and ignores a drop with no file', async () => {
    open();
    fireEvent.drop(list(), { dataTransfer: { types: ['Files'], files: [] } });
    expect(screen.queryByRole('alert')).toBeNull();
    const big = new File(['x'], 'big.json');
    Object.defineProperty(big, 'size', { value: TRACKER_FILE_MAX_BYTES + 1 });
    const read = vi.spyOn(big, 'text');
    drop(big);
    expect((await screen.findByRole('alert')).textContent).toContain('too big to import');
    expect(read).not.toHaveBeenCalled();
  });

  it.each([
    ['a CSV no tool wrote, on a Dashboard tab', JSON_TAB, EDITOR, 'Name,Due\nA,B', DROP_UNKNOWN],
    ['JSON no tool wrote, on a Dashboard tab', JSON_TAB, EDITOR, '{"a":1}', DROP_UNKNOWN],
    ['JSON no tool wrote, on a Board tab', csvTab(), EDITOR, '{"a":1}', DROP_NOT_CSV],
    ['a tab’s JSON, on a Board tab', csvTab(), EDITOR, TAB_JSON, DROP_TAB_JSON_HERE],
    ['JSON, on a Board tab, with no tools', csvTab(), NO_TRACKER, '{"a":1}', DROP_WANTS_CSV],
    ['JSON that is not JSON', JSON_TAB, EDITOR, '{"lists": [', "That file isn't valid JSON."],
    [
      'a tool’s CSV with no cards',
      JSON_TAB,
      EDITOR,
      'Summary,Issue key,Status\n',
      'That file has no cards to import.',
    ],
    [
      'a tab’s JSON on a locked tab',
      { kind: 'json', blocked: 'Locked.' },
      EDITOR,
      TAB_JSON,
      'Locked.',
    ],
    ['a CSV on a locked Board tab', csvTab({ blocked: 'Locked.' }), EDITOR, 'A,B', 'Locked.'],
  ] as const)('says why it can’t take %s', async (_, intoTab, tracker, text, message) => {
    open({ intoTab, tracker });
    drop(new File([text], 'file.txt'));
    expect((await screen.findByRole('alert')).textContent).toBe(message);
  });
});

// A screen reader hears what the paste field is for, and why an import did not land.
describe('ImportTabDialog for a screen reader', () => {
  it('names the paste field and announces an error', async () => {
    open({ tracker: NO_TRACKER, outcome: { status: 'error', error: 'Not a liveplanner tab.' } });
    const field = screen.getByRole('textbox', { name: 'JSON to import' });
    fireEvent.change(field, { target: { value: '{}' } });
    fireEvent.click(screen.getByRole('button', { name: 'Import' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Not a liveplanner tab.');
  });
});
