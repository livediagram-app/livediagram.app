// @vitest-environment jsdom

// The Import dialog's Another Tool view (docs/specs/026-plan/tracker-import.md "Reading the file", "The preview",
// "The import"): choosing or dropping a file, its refusals, the preview's sections, where it goes (the tab choice
// dimmed when the plan has no room) and the import's outcomes.

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ITEM_TYPES,
  ITEMS_MAX,
  TRACKER_FILE_MAX_BYTES,
  type TrackerPlanContext,
} from '@liveplanner/items';
import type { TrackerImportActions, TrackerTarget } from '@/hooks/plan/useTrackerImport';
import { TRACKER_NOT_LOADED, TrackerImportPanel } from './TrackerImportPanel';
import { peopleLine } from './TrackerPreviewView';

const picker = vi.hoisted(() => ({ pickTabFile: vi.fn() }));
vi.mock('@/lib/import-tab', () => picker);

const JIRA = [
  'Summary,Issue key,Status,Assignee,Comment',
  'Fix login,AB-1,To Do,Ana Lopez,"12/Mar/25 10:15 AM;u1;Looking into it."',
  'Ship it,AB-2,Done,,',
  ',AB-3,Done,,',
].join('\n');
const ASANA = ['Task ID,Name,Section/Column', '1,Write it,Doing'].join('\n');

const ctx = (over: Partial<TrackerPlanContext> = {}): TrackerPlanContext => ({
  types: ITEM_TYPES,
  statuses: [],
  people: [],
  members: [],
  room: ITEMS_MAX,
  boardId: 'b1',
  ...over,
});

function tracker(
  contexts: Partial<Record<TrackerTarget, (TrackerPlanContext | null)[]>> = {},
  outcome: Awaited<ReturnType<TrackerImportActions['importPlan']>> = { ok: true },
) {
  const queues = { tab: [...(contexts.tab ?? [])], plan: [...(contexts.plan ?? [])] };
  return {
    canImport: true,
    // Each target's contexts in turn, the last kept; a plain one when none is given.
    contextFor: vi.fn(async (target: TrackerTarget): Promise<TrackerPlanContext | null> => {
      const queue = queues[target];
      if (queue.length === 0) return ctx();
      return queue.length > 1 ? queue.shift()! : queue[0]!;
    }),
    importPlan: vi.fn(async () => outcome),
  } satisfies TrackerImportActions;
}

function open(t: TrackerImportActions = tracker()) {
  const onDone = vi.fn();
  render(<TrackerImportPanel tracker={t} onDone={onDone} head={<p>switch</p>} />);
  return { onDone };
}

const pick = (text: string, name = 'issues.csv') =>
  picker.pickTabFile.mockResolvedValueOnce({ name, text, file: new File([text], name) });

async function choose() {
  fireEvent.click(screen.getByRole('button', { name: /Choose a File/ }));
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('TrackerImportPanel: reading the file', () => {
  it('opens on the file to choose, naming the four tools and where each keeps its export', () => {
    open();
    expect(screen.getByText('switch')).toBeTruthy();
    expect(
      within(screen.getByRole('list', { name: 'Exports it reads' }))
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(['TrelloJSON', 'AsanaCSV', 'JiraCSV', 'LinearCSV']);
    expect(screen.getByText('Where to Find the Export')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Import' })).toBeNull();
  });

  it('asks the picker for the exports it reads, capped at 20 MB, and stays put when nothing is picked', async () => {
    picker.pickTabFile.mockResolvedValueOnce(null);
    open();
    await choose();
    await waitFor(() =>
      expect(picker.pickTabFile).toHaveBeenCalledWith(expect.stringContaining('.csv'), {
        maxBytes: TRACKER_FILE_MAX_BYTES,
      }),
    );
    expect(screen.getByRole('button', { name: /Choose a File/ })).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('refuses a file past the cap unread, and a file from no tool it knows', async () => {
    picker.pickTabFile.mockResolvedValueOnce({
      name: 'big.json',
      text: '',
      file: null,
      tooBig: true,
    });
    open();
    await choose();
    expect((await screen.findByRole('alert')).textContent).toBe(
      'That file is too big to import. Imports read files up to 20 MB.',
    );
    pick('Name,Due\nA,B', 'notes.csv');
    await choose();
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toBe(
        "This file isn't a Trello, Asana, Jira or Linear export.",
      ),
    );
  });

  it('says so when the file can’t be read at all', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const t = tracker();
    t.contextFor.mockRejectedValueOnce(new Error('boom'));
    pick(JIRA);
    open(t);
    await choose();
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Couldn’t read that file. Check it and try again.',
    );
    expect(warn).toHaveBeenCalled();
  });

  it('reads a dropped file, highlighting the drop zone while it is over it', async () => {
    open();
    const zone = screen.getByRole('button', { name: /Choose a File/ });
    // Something other than a file passes over unnoticed.
    fireEvent.dragOver(zone, { dataTransfer: { types: ['text/plain'] } });
    expect(zone.className).not.toContain('border-brand-400');
    fireEvent.dragOver(zone, { dataTransfer: { types: ['Files'] } });
    expect(zone.className).toContain('border-brand-400');
    fireEvent.dragLeave(zone);
    expect(zone.className).not.toContain('border-brand-400');
    const file = new File([ASANA], 'Launch.csv', { type: 'text/csv' });
    fireEvent.drop(zone, { dataTransfer: { types: ['Files'], files: [file] } });
    expect(await screen.findByText('Launch')).toBeTruthy();
  });

  it('refuses a dropped file past the cap, and ignores a drop with no file', async () => {
    open();
    const zone = screen.getByRole('button', { name: /Choose a File/ });
    fireEvent.drop(zone, { dataTransfer: { types: ['Files'], files: [] } });
    const big = new File(['x'], 'big.json');
    Object.defineProperty(big, 'size', { value: TRACKER_FILE_MAX_BYTES + 1 });
    fireEvent.drop(zone, { dataTransfer: { types: ['Files'], files: [big] } });
    expect((await screen.findByRole('alert')).textContent).toContain('too big to import');
  });
});

describe('TrackerImportPanel: the preview', () => {
  it('shows the source, columns, fields, people, comments and what is left out', async () => {
    pick(JIRA);
    open();
    await choose();
    expect(await screen.findByText('issues')).toBeTruthy();
    expect(screen.getByText(/Jira export/)).toBeTruthy();
    const columns = within(screen.getByRole('region', { name: 'Columns' }));
    expect(columns.getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'To Do1',
      'Done1',
    ]);
    const fields = within(screen.getByRole('region', { name: 'Fields' }));
    expect(fields.getByText('Issue Key')).toBeTruthy();
    expect(fields.getAllByText('New Field').length).toBeGreaterThan(0);
    expect(screen.getByText('1 new named person.')).toBeTruthy();
    expect(
      screen.getByText('1 comment on 1 card, in an Imported comments thread on each.'),
    ).toBeTruthy();
    expect(screen.getByText('Rows with no title')).toBeTruthy();
    expect(screen.getAllByText('Makes a Board tab with 2 columns and 2 cards.').length).toBe(2);
    expect(screen.getByRole('radio', { name: /New Board Tab in This Plan/ })).toHaveProperty(
      'ariaChecked',
      'true',
    );
  });

  it('says when an export carries no comments and nothing is left out', async () => {
    pick(ASANA, 'launch.csv');
    open();
    await choose();
    expect(await screen.findByText('No comments come with this Asana export.')).toBeTruthy();
    expect(screen.getByText('Nothing left out.')).toBeTruthy();
    expect(screen.getByText('No one is assigned on these cards.')).toBeTruthy();
  });

  it('goes back to choosing a file', async () => {
    pick(ASANA);
    open();
    await choose();
    fireEvent.click(await screen.findByRole('button', { name: 'Choose Another File' }));
    expect(screen.getByRole('button', { name: /Choose a File/ })).toBeTruthy();
  });

  it('plans a new plan only when it is chosen, and keeps both plans', async () => {
    const t = tracker();
    pick(JIRA);
    open(t);
    await choose();
    await screen.findByText('issues');
    expect(t.contextFor.mock.calls.map((c) => c[0])).toEqual(['tab']);
    fireEvent.click(screen.getByRole('radio', { name: /New Plan/ }));
    await waitFor(() =>
      expect(
        screen.getAllByText('Makes a new plan with a Board tab of 2 columns and 2 cards.'),
      ).toHaveLength(2),
    );
    fireEvent.click(screen.getByRole('radio', { name: /New Board Tab/ }));
    fireEvent.click(screen.getByRole('radio', { name: /New Plan/ }));
    await waitFor(() =>
      expect(screen.getByRole('radio', { name: /New Plan/ })).toHaveProperty('ariaChecked', 'true'),
    );
    expect(t.contextFor.mock.calls.map((c) => c[0])).toEqual(['tab', 'plan']);
  });
});

describe('TrackerImportPanel: where it goes', () => {
  it('dims the tab choice with the reason when the plan has no room, and imports into a new plan', async () => {
    const t = tracker({ tab: [ctx({ room: 1 })] });
    pick(JIRA);
    const { onDone } = open(t);
    await choose();
    const tabRow = await screen.findByRole('radio', { name: /New Board Tab/ });
    expect(tabRow).toHaveProperty('disabled', true);
    expect(screen.getByRole('status').textContent).toBe(
      'This plan has room for 1 more card and this file has 2. It goes into a new plan instead, whole.',
    );
    fireEvent.click(tabRow);
    fireEvent.click(screen.getByRole('button', { name: 'Import' }));
    await waitFor(() =>
      expect(t.importPlan).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'issues' }),
        'plan',
      ),
    );
    // A new plan opens in this window: the dialog stays busy until it goes.
    expect(onDone).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Importing…' })).toHaveProperty('disabled', true);
  });

  it('dims the tab choice when the plan’s cards never loaded', async () => {
    pick(JIRA);
    open(tracker({ tab: [null] }));
    await choose();
    expect((await screen.findByRole('status')).textContent).toContain(TRACKER_NOT_LOADED);
  });

  it('says it failed when even a new plan can’t be planned', async () => {
    pick(JIRA);
    open(tracker({ tab: [null], plan: [null] }));
    await choose();
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Couldn’t import those cards. Try again.',
    );
  });
});

describe('TrackerImportPanel: the import', () => {
  it('imports into a new Board tab, planned again against the plan as it is, then closes', async () => {
    const t = tracker();
    pick(JIRA);
    const { onDone } = open(t);
    await choose();
    fireEvent.click(await screen.findByRole('button', { name: 'Import' }));
    await waitFor(() => expect(onDone).toHaveBeenCalledOnce());
    expect(t.importPlan).toHaveBeenCalledWith(expect.objectContaining({ source: 'jira' }), 'tab');
    expect(t.contextFor.mock.calls.map((c) => c[0])).toEqual(['tab', 'tab']);
  });

  it('moves to a new plan, importing nothing, when the plan filled up since the preview', async () => {
    const t = tracker({ tab: [ctx(), ctx({ room: 0 })] });
    pick(JIRA);
    open(t);
    await choose();
    fireEvent.click(await screen.findByRole('button', { name: 'Import' }));
    expect((await screen.findByRole('status')).textContent).toContain('room for 0 more cards');
    expect(t.importPlan).not.toHaveBeenCalled();
    expect(screen.getByRole('radio', { name: /New Plan/ })).toHaveProperty('ariaChecked', 'true');
  });

  it('keeps the dialog open with the reason when the import fails', async () => {
    const t = tracker({}, { ok: false, error: 'Couldn’t import those cards. Try again.' });
    pick(JIRA);
    const { onDone } = open(t);
    await choose();
    fireEvent.click(await screen.findByRole('button', { name: 'Import' }));
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Couldn’t import those cards. Try again.',
    );
    expect(onDone).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Import' })).toHaveProperty('disabled', false);
  });
});

describe('TrackerImportPanel: edge cases', () => {
  it('names a Trello export a board', async () => {
    pick(
      JSON.stringify({
        name: 'Site',
        lists: [{ id: 'l1', name: 'To Do', pos: 1 }],
        cards: [{ id: 'c1', name: 'A', idList: 'l1' }],
      }),
      'site.json',
    );
    open();
    await choose();
    expect(await screen.findByText(/Trello board/)).toBeTruthy();
    expect(screen.getByText('Site')).toBeTruthy();
  });

  it('keeps the choice when it is chosen again, or a new plan can’t be planned', async () => {
    const t = tracker({ plan: [null] });
    pick(JIRA);
    open(t);
    await choose();
    fireEvent.click(await screen.findByRole('radio', { name: /New Board Tab/ }));
    fireEvent.click(screen.getByRole('radio', { name: /New Plan/ }));
    await waitFor(() => expect(t.contextFor).toHaveBeenCalledWith('plan'));
    expect(screen.getByRole('radio', { name: /New Board Tab/ })).toHaveProperty(
      'ariaChecked',
      'true',
    );
  });

  it('says it failed when the plan filled up and a new plan can’t be planned', async () => {
    pick(JIRA);
    open(tracker({ tab: [ctx(), null], plan: [null] }));
    await choose();
    fireEvent.click(await screen.findByRole('button', { name: 'Import' }));
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Couldn’t import those cards. Try again.',
    );
    expect(screen.getByRole('radio', { name: /New Board Tab/ })).toHaveProperty(
      'ariaChecked',
      'true',
    );
  });
});

describe('peopleLine', () => {
  it('names each kind of person the import brings, in one sentence', () => {
    expect(peopleLine({ matched: 1, onPlan: 0, named: 0 })).toBe(
      '1 person matched to team members.',
    );
    expect(peopleLine({ matched: 2, onPlan: 3, named: 4 })).toBe(
      '2 people matched to team members, 3 already on this plan and 4 new named people.',
    );
  });
});
