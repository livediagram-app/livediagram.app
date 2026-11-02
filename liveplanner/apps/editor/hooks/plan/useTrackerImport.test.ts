// @vitest-environment jsdom

// A board from another tool, planned against the plan and written (docs/specs/026-plan/tracker-import.md "The
// import"): what it plans against, the writes into a new Board tab, a new plan (signed in or a guest), and refusals.

import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ITEM_TYPES,
  ITEMS_MAX,
  planTrackerImport,
  type Item,
  type TrackerBoard,
  type TrackerPlanContext,
} from '@liveplanner/items';
import type { Tab } from '@liveplanner/project';
import { readTrackerText } from '@/lib/tracker-file';
import { TRACKER_IMPORT_FAILED, trackerBoardTab, useTrackerImport } from './useTrackerImport';

const api = vi.hoisted(() => ({
  apiCreateProject: vi.fn(async () => ({})),
  apiTeamMembers: vi.fn(async (): Promise<unknown[]> => []),
}));
vi.mock('@/lib/api-client', () => api);
const items = vi.hoisted(() => ({ writeItem: vi.fn(async () => ({})) }));
vi.mock('@/lib/api/items', () => items);
const offline = vi.hoisted(() => ({
  offlineCreateProject: vi.fn(async () => ({})),
  offlineWriteItem: vi.fn(async () => ({})),
}));
vi.mock('@/lib/offline/offline-store', () => ({
  offlineCreateProject: offline.offlineCreateProject,
}));
vi.mock('@/lib/offline/offline-items', () => ({ offlineWriteItem: offline.offlineWriteItem }));
const telemetry = vi.hoisted(() => ({ track: vi.fn() }));
vi.mock('@/lib/telemetry', () => telemetry);

const me = { id: 'p-me', name: 'Sam', color: '#2563eb' };
const JIRA = [
  'Summary,Issue key,Status,Assignee,Comment',
  'Fix login,AB-1,To Do,Ana Lopez,"12/Mar/25 10:15 AM;u1;Looking into it."',
  'Ship it,AB-2,Done,,',
].join('\n');

function boardOf(text: string, name = 'jira.csv'): TrackerBoard {
  const read = readTrackerText(text, name);
  if ('error' in read) throw new Error(read.error);
  return read.board;
}

const tab = (id: string, look?: Partial<Tab>): Tab => ({
  id,
  name: id,
  elements: [],
  ...look,
});

const assigned: Item = {
  id: 'i1',
  type: 'task',
  key: 1,
  rank: 'i',
  fields: { title: 'Old', status: 'todo', assignee: { id: 'n-bo', name: 'Bo', color: '#000' } },
  rev: 1,
  createdAt: 0,
  updatedAt: 0,
  createdBy: me,
  updatedBy: me,
};

function setup(over: Partial<Parameters<typeof useTrackerImport>[0]> = {}) {
  let tabs = [tab('t1', { theme: 'dusk' }), tab('t2')];
  const props: Parameters<typeof useTrackerImport>[0] = {
    canImport: true,
    projectId: 'p1',
    ownerId: 'owner',
    signedIn: false,
    teamId: null,
    self: me,
    selfParticipant: { id: 'owner', name: 'Sam', color: '#2563eb' },
    teamPeople: [],
    status: 'ready',
    items: new Map([[assigned.id, assigned]]),
    tabs,
    activeId: 't1',
    catalogue: null,
    types: ITEM_TYPES,
    saveType: vi.fn(),
    write: vi.fn(async () => true),
    commitTabs: vi.fn((map: (ts: Tab[]) => Tab[]) => {
      tabs = map(tabs);
    }),
    createTab: (name: string) => ({ id: 'new-tab', name, elements: [], defaultTextSize: 'sm' }),
    markTabLoaded: vi.fn(),
    openTab: vi.fn(),
    openProject: vi.fn(),
    notify: vi.fn(),
    readyWaitMs: 120,
    ...over,
  };
  const { result, rerender } = renderHook((p: typeof props) => useTrackerImport(p), {
    initialProps: props,
  });
  return {
    props,
    tracker: () => result.current,
    tabs: () => tabs,
    become: (next: Partial<typeof props>) => rerender({ ...props, ...next }),
  };
}

async function planned(
  s: ReturnType<typeof setup>,
  target: 'tab' | 'plan',
  text = JIRA,
): Promise<ReturnType<typeof planTrackerImport>> {
  const ctx = (await s.tracker().contextFor(target)) as TrackerPlanContext;
  return planTrackerImport(boardOf(text), ctx);
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.restoreAllMocks());

describe('useTrackerImport: what it plans against', () => {
  it('plans a new plan against nothing: no types, states or people, room for every card', async () => {
    const ctx = await setup().tracker().contextFor('plan');
    expect(ctx).toMatchObject({
      types: [],
      statuses: [],
      people: [],
      members: [],
      room: ITEMS_MAX,
    });
  });

  it('plans this plan against its types, states, people and room, once its cards load', async () => {
    const s = setup({ status: 'loading', teamPeople: [{ id: 'p-t', name: 'Tia', color: '#111' }] });
    const pending = s.tracker().contextFor('tab');
    s.become({ status: 'ready' });
    const ctx = await pending;
    expect(ctx!.types).toBe(ITEM_TYPES);
    expect(ctx!.people.map((p) => p.name)).toEqual(['Sam', 'Tia', 'Bo']);
    expect(ctx!.room).toBe(ITEMS_MAX - 1);
    expect(ctx!.members).toEqual([]);
    expect(api.apiTeamMembers).not.toHaveBeenCalled();
    // Before the plan knows who this is, only the plan's own people.
    const anon = await setup({ self: null }).tracker().contextFor('tab');
    expect(anon!.people.map((p) => p.name)).toEqual(['Bo']);
  });

  it('reads none when the plan’s cards never load', async () => {
    expect(await setup({ status: 'error' }).tracker().contextFor('tab')).toBeNull();
  });

  it('matches emails to the plan team’s joined members, signed in', async () => {
    api.apiTeamMembers.mockResolvedValueOnce([
      { status: 'joined', userId: 'u1', email: 'Ana@Example.com', name: 'Ana Lopez' },
      { status: 'invited', userId: null, email: 'zed@example.com', name: null },
      { status: 'joined', userId: 'u3', email: null, name: 'No Mail' },
    ]);
    const ctx = await setup({ signedIn: true, teamId: 'team1' }).tracker().contextFor('tab');
    expect(api.apiTeamMembers).toHaveBeenCalledWith('owner', 'team1');
    expect(ctx!.members).toEqual([
      { email: 'ana@example.com', person: expect.objectContaining({ name: 'Ana Lopez' }) },
    ]);
  });

  it('reads no members when the team’s list fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    api.apiTeamMembers.mockRejectedValueOnce(new Error('down'));
    const ctx = await setup({ signedIn: true, teamId: 'team1' }).tracker().contextFor('tab');
    expect(ctx!.members).toEqual([]);
    expect(warn).toHaveBeenCalled();
  });
});

describe('useTrackerImport: into a new Board tab', () => {
  it('saves the card type, adds and opens the tab after the open one, then makes every card with its thread', async () => {
    const s = setup();
    const plan = await planned(s, 'tab');
    expect(await s.tracker().importPlan(plan, 'tab')).toEqual({ ok: true });
    expect(s.props.saveType).toHaveBeenCalledWith(plan.type);
    expect(s.tabs().map((t) => t.id)).toEqual(['t1', 'new-tab', 't2']);
    const made = s.tabs()[1]!;
    expect(made).toMatchObject({ name: 'jira', kind: 'board', theme: 'dusk' });
    expect(made.elements).toEqual([plan.board]);
    expect(s.props.markTabLoaded).toHaveBeenCalledWith('new-tab');
    expect(s.props.openTab).toHaveBeenCalledWith('new-tab');
    const write = vi.mocked(s.props.write).mock.calls[0]![0] as {
      kind: 'create';
      creates: { threads?: { title: string }[] }[];
    };
    expect(write.kind).toBe('create');
    expect(write.creates).toHaveLength(2);
    expect(write.creates[0]!.threads![0]!.title).toBe('Imported comments');
    expect(write.creates[1]).not.toHaveProperty('threads');
    expect(write.creates[0]).not.toHaveProperty('importedComments');
    expect(telemetry.track).toHaveBeenCalledWith('Plan', 'Imported', 'Jira');
    expect(s.props.notify).toHaveBeenCalledWith('Imported 2 cards from Jira');
  });

  it('leaves the card type alone when the plan already has it as it is', async () => {
    const first = setup();
    const plan = await planned(first, 'tab');
    // The plan after that import: its type, and its board naming the type's states.
    const s = setup({
      types: [...ITEM_TYPES, plan.type],
      tabs: [{ ...tab('t1'), elements: [plan.board] }],
    });
    await s.tracker().importPlan(await planned(s, 'tab'), 'tab');
    expect(s.props.saveType).not.toHaveBeenCalled();
  });

  it('says so when the cards are refused', async () => {
    const s = setup({ write: vi.fn(async () => false) });
    expect(await s.tracker().importPlan(await planned(s, 'tab'), 'tab')).toEqual({
      ok: false,
      error: TRACKER_IMPORT_FAILED,
    });
    expect(s.props.notify).not.toHaveBeenCalled();
  });

  it('refuses with no plan open, and for a session that may not make tabs', async () => {
    const none = setup({ projectId: null });
    expect(await none.tracker().importPlan(await planned(none, 'tab'), 'tab')).toMatchObject({
      ok: false,
    });
    // A Participant or a Viewer (tracker-import.md "Who may"): nothing is written.
    const viewer = setup({ canImport: false });
    expect(viewer.tracker().canImport).toBe(false);
    expect(await viewer.tracker().importPlan(await planned(viewer, 'tab'), 'tab')).toEqual({
      ok: false,
      error: TRACKER_IMPORT_FAILED,
    });
    expect(viewer.props.commitTabs).not.toHaveBeenCalled();
    expect(viewer.props.write).not.toHaveBeenCalled();
  });

  it('answers a failure that throws', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const s = setup({
      write: vi.fn(async () => {
        throw new Error('offline');
      }),
    });
    expect(await s.tracker().importPlan(await planned(s, 'tab'), 'tab')).toEqual({
      ok: false,
      error: TRACKER_IMPORT_FAILED,
    });
    expect(warn).toHaveBeenCalledWith('[tracker-import] failed', expect.anything());
  });
});

describe('useTrackerImport: into a new plan', () => {
  it('creates it signed in with the tab, the card type and its cards, then opens it', async () => {
    const s = setup({ signedIn: true });
    const plan = await planned(s, 'plan');
    expect(await s.tracker().importPlan(plan, 'plan')).toEqual({ ok: true });
    const [owner, body] = api.apiCreateProject.mock.calls[0] as unknown as [
      string,
      Record<string, unknown>,
    ];
    expect(owner).toBe('owner');
    expect(body).toMatchObject({
      name: 'jira',
      intent: { mode: 'plan', tabKind: 'board' },
      itemTypes: { types: [plan.type] },
      tabs: [expect.objectContaining({ kind: 'board', elements: [plan.board] })],
    });
    expect(body['items']).toHaveLength(2);
    expect(items.writeItem).not.toHaveBeenCalled();
    expect(s.props.openProject).toHaveBeenCalledWith(body['id']);
    expect(telemetry.track).toHaveBeenCalledWith('Plan', 'Imported', 'Jira');
  });

  it('sends the cards past the create’s room after it', async () => {
    const rows = Array.from({ length: 250 }, (_, i) => `Card ${i},AB-${i},To Do,,`);
    const big = ['Summary,Issue key,Status,Assignee,Comment', ...rows].join('\n');
    const s = setup({ signedIn: true, self: null });
    await s.tracker().importPlan(await planned(s, 'plan', big), 'plan');
    const body = (
      api.apiCreateProject.mock.calls[0] as unknown as [string, { items: unknown[] }]
    )[1];
    expect(body.items).toHaveLength(200);
    const [scope, write, by] = items.writeItem.mock.calls[0] as unknown as [
      { projectId: string },
      { creates: unknown[] },
      { name: string },
    ];
    expect(scope.projectId).toBe((body as unknown as { id: string }).id);
    expect(write.creates).toHaveLength(50);
    expect(by.name).toBe('Sam');
  });

  it('keeps a guest’s new plan in This Browser', async () => {
    const s = setup({ signedIn: false });
    await s.tracker().importPlan(await planned(s, 'plan'), 'plan');
    expect(api.apiCreateProject).not.toHaveBeenCalled();
    expect(offline.offlineCreateProject).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'jira' }),
      expect.any(Number),
    );
    expect(offline.offlineWriteItem).toHaveBeenCalledWith(
      expect.any(String),
      { kind: 'create', creates: expect.any(Array) },
      me,
    );
    expect(s.props.openProject).toHaveBeenCalled();
    // A guest not yet named on the plan's cards signs them as themselves.
    const anon = setup({ signedIn: false, self: null });
    await anon.tracker().importPlan(await planned(anon, 'plan'), 'plan');
    expect(offline.offlineWriteItem).toHaveBeenLastCalledWith(
      expect.any(String),
      expect.anything(),
      expect.objectContaining({ name: 'Sam' }),
    );
  });
});

describe('trackerBoardTab', () => {
  it('names the tab after the board and takes the open tab’s look', async () => {
    const plan = await planned(setup(), 'plan');
    const made = trackerBoardTab(plan, tab('x'), tab('look', { font: 'serif' }));
    expect(made).toMatchObject({ id: 'x', name: 'jira', kind: 'board', font: 'serif' });
    expect(trackerBoardTab(plan, tab('y'))).toMatchObject({ id: 'y', kind: 'board' });
  });
});
