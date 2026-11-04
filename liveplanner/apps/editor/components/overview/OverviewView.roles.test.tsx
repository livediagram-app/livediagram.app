// @vitest-environment jsdom

// The Overview for each share role, and its empty states (docs/specs/026-plan/plan-overview.md "Share roles").
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { overviewModelOf } from './overview-model';
import { OverviewView, type OverviewAbilities, type OverviewActions } from './OverviewView';
import { TYPES, boardTab, card, itemsOf } from './overview-fixtures.test-helpers';

afterEach(cleanup);

const NOW = 1_800_000_000_000;
const MODEL = overviewModelOf({
  tabs: [boardTab('a', 'Triage'), boardTab('b', 'Tasks', { addTypes: ['task'] })],
  items: itemsOf(
    Array.from({ length: 12 }, (_, i) =>
      card(`${i + 1}`, { createdAt: NOW - (i + 1) * 60_000, updatedAt: NOW - (i + 1) * 60_000 }),
    ),
  ),
  types: TYPES,
  loadedTabIds: new Set(['a', 'b']),
  owner: { id: 'owner', name: 'Ana Moreno', color: '#b4461c' },
  present: [],
  createdAt: NOW - 86_400_000,
});

// What `can.level` grants on the Overview, as OverviewPage works it out.
const ROLES: Record<'Editor' | 'Participant' | 'Viewer', OverviewAbilities> = {
  Editor: { editPlan: true, addTab: true, editTypes: true, addType: true },
  Participant: { editPlan: false, addTab: false, editTypes: false, addType: true },
  Viewer: { editPlan: false, addTab: false, editTypes: false, addType: true },
};

function actions(): OverviewActions {
  return {
    openTab: vi.fn(),
    addTab: vi.fn(),
    editType: vi.fn(),
    addField: vi.fn(),
    addCard: vi.fn(),
    addTypeToBoard: vi.fn(),
    addType: vi.fn(),
    openCard: vi.fn(),
    rename: vi.fn(),
    describe: vi.fn(),
  };
}

function view(may: OverviewAbilities, over: Partial<Parameters<typeof OverviewView>[0]> = {}) {
  const act = actions();
  render(
    <OverviewView
      name="Bug Triage"
      description=""
      dates="Created by Ana Moreno on 14 Oct"
      model={MODEL}
      preview={() => null}
      now={NOW}
      may={may}
      actions={act}
      {...over}
    />,
  );
  return act;
}

describe('Overview share roles', () => {
  it('gives an Editor every control, each doing its action', () => {
    const act = view(ROLES.Editor);
    // The name is edited in place: its heading keeps the plan's name, the button over it says Rename.
    expect(screen.getByRole('heading', { level: 1, name: 'Bug Triage' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Rename' }));
    const name = screen.getByRole('textbox', { name: 'Plan Name' });
    fireEvent.change(name, { target: { value: 'Bugs' } });
    fireEvent.keyDown(name, { key: 'Enter' });
    expect(act.rename).toHaveBeenCalledWith('Bugs');
    // Add a Description starts editing the empty description.
    fireEvent.click(screen.getByRole('button', { name: 'Add a Description' }));
    const description = screen.getByRole('textbox', { name: 'Description' });
    fireEvent.change(description, { target: { value: 'Where bugs land.' } });
    fireEvent.blur(description);
    expect(act.describe).toHaveBeenCalledWith('Where bugs land.');
    // Sharing is the app header's: the Overview has no Share of its own.
    expect(screen.queryByRole('button', { name: 'Share' })).toBeNull();
    // The Add Tab tile is the one way in: no button beside the Tabs heading.
    const addTabs = screen.getAllByRole('button', { name: /Add Tab/ });
    expect(addTabs).toHaveLength(1);
    fireEvent.click(addTabs[0]!);
    expect(act.addTab).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Edit Bug' }));
    expect(act.editType).toHaveBeenCalledWith('bug');
    fireEvent.click(screen.getByRole('button', { name: /Add Card Type/ }));
    expect(act.addType).toHaveBeenCalled();
  });

  for (const role of ['Participant', 'Viewer'] as const)
    it(`lets a ${role} open tabs and cards but change nothing`, () => {
      const act = view(ROLES[role], { description: 'Where bugs land.' });
      for (const name of [
        'Rename',
        'Edit Description',
        'Add a Description',
        'Share',
        /Add Tab/,
        /Add Card Type/,
      ])
        expect(screen.queryByRole('button', { name })).toBeNull();
      // The name and description are plain text.
      expect(screen.getByRole('heading', { level: 1, name: 'Bug Triage' })).toBeTruthy();
      expect(document.querySelector('[data-overview-description]')!.tagName).toBe('P');
      expect(screen.queryByRole('textbox')).toBeNull();
      // Card type tiles only show: no quick actions, no Add to a Board.
      expect(screen.queryByRole('group', { name: 'Bug Actions' })).toBeNull();
      expect(screen.queryByRole('button', { name: /Add to a Board/ })).toBeNull();
      fireEvent.click(document.querySelector('[data-tab-tile="b"]') as HTMLElement);
      expect(act.openTab).toHaveBeenCalledWith('b');
      const activity = screen.getByRole('region', { name: 'Plan Overview' });
      fireEvent.click(within(activity).getAllByRole('button', { name: /added Card/ })[0]!);
      expect(act.openCard).toHaveBeenCalledWith('1');
    });

  it('leaves Add Card Type out at the most types, and lets an Editor edit a description there is', () => {
    view({ ...ROLES.Editor, addType: false }, { description: 'Where bugs land.' });
    expect(screen.queryByRole('button', { name: /Add Card Type/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add a Description' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Edit Description' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Rename' })).toBeTruthy();
  });
});

describe('Overview content', () => {
  it('shows the plan’s name, description, dates and people', () => {
    view(ROLES.Viewer, { description: 'Where bugs land.\nAnd get fixed.' });
    expect(screen.getByRole('heading', { level: 1, name: 'Bug Triage' })).toBeTruthy();
    expect(document.querySelector('[data-overview-description]')!.textContent).toBe(
      'Where bugs land.\nAnd get fixed.',
    );
    expect(screen.getByText('Created by Ana Moreno on 14 Oct')).toBeTruthy();
    expect(screen.queryByText(/^\d+ (Person|People)$/)).toBeNull();
    // Each person is a disc with their name under it.
    const ana = screen.getByRole('img', { name: 'Ana Moreno' });
    expect(ana.textContent).toBe('AMAna Moreno');
  });

  it('lists eight entries, then every one with See All, and fewer again', () => {
    view(ROLES.Viewer);
    const entries = () => document.querySelectorAll('[data-dot]').length;
    expect(entries()).toBe(8);
    fireEvent.click(screen.getByRole('button', { name: 'See All' }));
    // 12 cards made, and the plan made.
    expect(entries()).toBe(13);
    expect(document.querySelectorAll('[data-dot="setup"]')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Show Fewer' }));
    expect(entries()).toBe(8);
  });

  it('names a type no board takes, and draws a Board tile with its line', () => {
    view(ROLES.Viewer);
    const tile = document.querySelector('[data-tab-tile="a"]') as HTMLElement;
    expect(tile.textContent).toContain('Board · 12 Cards');
    const incident = document.querySelector('[data-card-type-tile="incident"]') as HTMLElement;
    expect(within(incident).getByRole('button', { name: 'Open Triage' })).toBeTruthy();
  });

  it('shows five people with their names, then More naming the rest (three on a phone)', () => {
    const people = Array.from({ length: 7 }, (_, i) => ({
      id: `p${i}`,
      name: `P ${i}`,
      color: '#123456',
    }));
    view(ROLES.Viewer, { model: { ...MODEL, people } });
    const row = screen.getByRole('list', { name: 'People on the plan' });
    const named = within(row)
      .getAllByRole('img')
      .filter((el) => !el.getAttribute('aria-label')!.startsWith('More'));
    expect(named.map((el) => el.getAttribute('aria-label'))).toEqual([
      'P 0',
      'P 1',
      'P 2',
      'P 3',
      'P 4',
    ]);
    // The fourth and fifth are left out on a phone.
    expect(named.map((el) => el.closest('li')!.className.includes('max-sm:hidden'))).toEqual([
      false,
      false,
      false,
      true,
      true,
    ]);
    // One More per width: the rest past five from sm, past three on a phone.
    const wide = row.querySelector('[data-overview-more="2"]')!;
    expect(wide.className).toContain('max-sm:hidden');
    expect(
      within(wide as HTMLElement).getByRole('img', { name: 'More: P 5, P 6' }).textContent,
    ).toBe('+2More');
    const narrow = row.querySelector('[data-overview-more="4"]')!;
    expect(narrow.className).toContain('sm:hidden');
    expect(
      within(narrow as HTMLElement).getByRole('img', { name: 'More: P 3, P 4, P 5, P 6' }),
    ).toBeTruthy();
    expect(screen.queryByText('7 People')).toBeNull();
  });

  it('leaves More out when everyone fits', () => {
    view(ROLES.Viewer);
    expect(document.querySelector('[data-overview-more]')).toBeNull();
  });
});

describe('Overview empty states', () => {
  const EMPTY = { ...MODEL, cardTypes: [], activity: [], people: [] };

  it('says there is no activity and, for an Editor, how to add a card type', () => {
    view(ROLES.Editor, { model: EMPTY, dates: null });
    expect(screen.getByText('No Activity Yet')).toBeTruthy();
    expect(
      screen.getByText('Changes to cards will show here, as people add and move them.'),
    ).toBeTruthy();
    expect(screen.getByText('No Card Types Yet')).toBeTruthy();
    expect(screen.getByText('Add a card type to give cards their own fields.')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Add Card Type/ })).toBeTruthy();
    expect(screen.queryByText(/People?$/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'See All' })).toBeNull();
  });

  it('tells anyone else the plan has no card types, with nothing to press', () => {
    view(ROLES.Viewer, { model: EMPTY });
    expect(screen.getByText('This plan has no card types yet.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Add Card Type/ })).toBeNull();
  });
});

describe('Overview Add tiles, chips and activity', () => {
  it('lets an Editor start a tab of each kind straight from the Add Tab tile', () => {
    const act = view(ROLES.Editor);
    const kinds = screen.getByRole('group', { name: 'Start a Tab As' });
    expect(
      within(kinds)
        .getAllByRole('button')
        .map((b) => b.getAttribute('aria-label')),
    ).toEqual(['Add a Board', 'Add a Sheet', 'Add a Dashboard', 'Add a Form']);
    fireEvent.click(within(kinds).getByRole('button', { name: 'Add a Sheet' }));
    expect(act.addTab).toHaveBeenCalledWith('sheets');
  });

  it('gives no one else the kinds', () => {
    view(ROLES.Viewer);
    expect(screen.queryByRole('group', { name: 'Start a Tab As' })).toBeNull();
  });

  it('leads each card type tile with its chip, and gives each entry its type chip', () => {
    view(ROLES.Viewer);
    const tile = document.querySelector('[data-card-type-tile="bug"]') as HTMLElement;
    expect(tile.querySelector('[data-card-type-chip-face]')!.textContent).toBe('Bug');
    const entry = document.querySelector('[data-activity-entry="added"]') as HTMLElement;
    expect(entry.querySelector('[data-card-type-chip-face]')!.textContent).toBe('Bug');
    // Grouped by day, the person's disc shown once for a run of their entries.
    expect(screen.getByRole('region', { name: 'Today' })).toBeTruthy();
  });
});

describe('Overview card type tiles', () => {
  it('shows each type’s sample, fields, cards by status and boards, a board link opening its tab', () => {
    const act = view(ROLES.Viewer);
    const bug = document.querySelector('[data-card-type-tile="bug"]') as HTMLElement;
    // Twelve bugs: the latest drawn as its sample; a type with none draws its example.
    expect(
      bug.querySelector('[data-card-type-sample]')!.getAttribute('data-card-type-sample'),
    ).toBe('card');
    expect(bug.querySelector('[data-card-type-sample]')!.getAttribute('aria-hidden')).toBe('true');
    expect(
      document
        .querySelector('[data-card-type-tile="task"] [data-card-type-sample]')!
        .getAttribute('data-card-type-sample'),
    ).toBe('example');
    expect(bug.querySelector('[data-type-cards]')!.textContent).toBe('12 Cards');
    expect(within(bug).getByRole('img', { name: 'To Do: 12 Cards' })).toBeTruthy();
    // Seven fields: five chips, then the rest counted.
    expect(within(bug).getByRole('list', { name: 'Fields' }).textContent).toContain('+2 More');
    fireEvent.click(within(bug).getByRole('button', { name: 'Open Triage' }));
    expect(act.openTab).toHaveBeenCalledWith('a');
  });

  it('gives an Editor Edit, Add Field and Add Card on each type', () => {
    const act = view(ROLES.Editor);
    const actions = screen.getByRole('group', { name: 'Bug Actions' });
    fireEvent.click(within(actions).getByRole('button', { name: 'Add Field' }));
    expect(act.addField).toHaveBeenCalledWith('bug');
    fireEvent.click(within(actions).getByRole('button', { name: 'Add a Bug' }));
    expect(act.addCard).toHaveBeenCalledWith('bug');
  });

  it('offers an Editor Add to a Board for a type no board takes', () => {
    const model = overviewModelOf({
      tabs: [boardTab('b', 'Tasks', { addTypes: ['task'] })],
      items: new Map(),
      types: TYPES,
      loadedTabIds: new Set(['b']),
      owner: null,
      present: [],
      createdAt: 0,
    });
    const act = view(ROLES.Editor, { model });
    const bug = document.querySelector('[data-card-type-tile="bug"]') as HTMLElement;
    expect(bug.querySelector('[data-used-on="none"]')!.textContent).toBe('Not on any board yet');
    // No board takes it, so there is nowhere to Add Card.
    expect(within(bug).queryByRole('button', { name: 'Add a Bug' })).toBeNull();
    fireEvent.click(within(bug).getByRole('button', { name: 'Add to a Board' }));
    expect(act.addTypeToBoard).toHaveBeenCalledWith('bug', 'b-board');
    cleanup();
    view(ROLES.Viewer, { model });
    expect(screen.queryByRole('button', { name: 'Add to a Board' })).toBeNull();
  });
});
