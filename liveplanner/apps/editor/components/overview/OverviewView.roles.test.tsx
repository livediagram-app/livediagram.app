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
  Editor: { editDetails: true, addTab: true, editTypes: true, addType: true, share: true },
  Participant: { editDetails: false, addTab: false, editTypes: false, addType: true, share: false },
  Viewer: { editDetails: false, addTab: false, editTypes: false, addType: true, share: false },
};

function actions(): OverviewActions {
  return {
    openTab: vi.fn(),
    addTab: vi.fn(),
    editType: vi.fn(),
    addType: vi.fn(),
    openCard: vi.fn(),
    editDetails: vi.fn(),
    share: vi.fn(),
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
    fireEvent.click(screen.getByRole('button', { name: /Edit Details/ }));
    expect(act.editDetails).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Add a Description' }));
    expect(act.editDetails).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole('button', { name: 'Share' }));
    expect(act.share).toHaveBeenCalled();
    const addTabs = screen.getAllByRole('button', { name: /Add Tab/ });
    expect(addTabs).toHaveLength(2);
    for (const b of addTabs) fireEvent.click(b);
    expect(act.addTab).toHaveBeenCalledTimes(2);
    fireEvent.click(document.querySelector('[data-card-type-tile="bug"]') as HTMLElement);
    expect(act.editType).toHaveBeenCalledWith('bug');
    fireEvent.click(screen.getByRole('button', { name: /Add Card Type/ }));
    expect(act.addType).toHaveBeenCalled();
  });

  for (const role of ['Participant', 'Viewer'] as const)
    it(`lets a ${role} open tabs and cards but change nothing`, () => {
      const act = view(ROLES[role]);
      for (const name of [/Edit Details/, 'Add a Description', 'Share', /Add Tab/, /Add Card Type/])
        expect(screen.queryByRole('button', { name })).toBeNull();
      // Card type tiles only show.
      expect(document.querySelector('[data-card-type-tile="bug"]')!.tagName).toBe('DIV');
      fireEvent.click(document.querySelector('[data-tab-tile="b"]') as HTMLElement);
      expect(act.openTab).toHaveBeenCalledWith('b');
      const activity = screen.getByRole('region', { name: 'Plan Overview' });
      fireEvent.click(within(activity).getAllByRole('button', { name: /added Card/ })[0]!);
      expect(act.openCard).toHaveBeenCalledWith('1');
    });

  it('shares only for whoever may share, and leaves Add Card Type out at the most types', () => {
    view({ ...ROLES.Editor, share: false, addType: false });
    expect(screen.queryByRole('button', { name: 'Share' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Add Card Type/ })).toBeNull();
    expect(screen.getByRole('button', { name: /Edit Details/ })).toBeTruthy();
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
    expect(screen.getByText('1 Person')).toBeTruthy();
    expect(screen.getByLabelText('Ana Moreno')).toBeTruthy();
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
    expect(document.querySelector('[data-card-type-tile="incident"]')!.textContent).toContain(
      'On Triage',
    );
  });

  it('shows more people than fit as a count', () => {
    const people = Array.from({ length: 7 }, (_, i) => ({
      id: `p${i}`,
      name: `P ${i}`,
      color: '#123456',
    }));
    view(ROLES.Viewer, { model: { ...MODEL, people } });
    expect(screen.getByText('+2')).toBeTruthy();
    expect(screen.getByText('7 People')).toBeTruthy();
  });
});

describe('Overview empty states', () => {
  const EMPTY = { ...MODEL, cardTypes: [], activity: [], people: [] };

  it('says there is no activity and, for an Editor, how to add a card type', () => {
    view(ROLES.Editor, { model: EMPTY, dates: null });
    expect(screen.getByText('No Activity Yet')).toBeTruthy();
    expect(screen.getByText('Changes to cards will show here.')).toBeTruthy();
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
