// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Item, ItemTypeDef } from '@liveplanner/items';
import {
  newSessionTab,
  type SessionFacilitator,
  type SessionSetup,
  type SessionTabState,
  type Tab,
} from '@liveplanner/project';
import type { PlanContextValue } from '@/components/plan/PlanContext';
import { liveThreads, PLAN } from '@/components/plan/threads/thread-test-kit';
import type { SessionTabActions } from '@/hooks/plan/useSessionTabActions';
import { recordSessionOutcome } from '@/lib/api/item-history';
import { track } from '@/lib/telemetry';

vi.mock('@liveworkspace/workbench/hooks/ui/useIsMobileViewport', () => ({
  useIsMobileViewport: () => false,
}));
vi.mock('@/hooks/ui/useCanvasLayerInsets', () => ({ useCanvasLayerInsets: () => ({}) }));
vi.mock('@/components/plan/CanvasCover', () => ({
  CanvasCover: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/components/plan/dashboard/DashboardMenuName', () => ({ DashboardMenuName: () => null }));
vi.mock('./SessionCard', () => ({
  SessionCard: ({ item }: { item: Item }) => <h3>{item.fields.title as string}</h3>,
}));
vi.mock('@/lib/api/item-history', () => ({ recordSessionOutcome: vi.fn(async () => {}) }));
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
vi.mock('./session-chime', () => ({ playSessionChime: vi.fn() }));

import { SessionPage } from './SessionPage';

// docs/specs/026-plan/session-tabs.md "Stand-up", "Share roles": the in-flight cards walked person by person; Done
// records Discussed on each of a person's cards and moves on; Blocked flags with a reason kept as a comment; Stage
// moves the real card; Undo Last takes each back; Session Complete lists the blockers.
const DAY = 86_400_000;
const NOW = 100 * DAY + 12 * 3_600_000;
const task: ItemTypeDef = {
  id: 'task',
  label: 'Task',
  newTitle: 'New task',
  glyph: 'task',
  color: '#0ea5e9',
  prefix: 'WI',
  fields: ['title', 'status', 'assignee', 'description'],
  statuses: ['todo', 'doing', 'review', 'done'],
};
const ANA = { id: 'p-ana', name: 'Ana Diaz', color: '#d97706' };
const BO = { id: 'p-bo', name: 'Bo Lee', color: '#7c3aed' };
const card = (id: string, key: number, fields: Item['fields']): Item => ({
  id,
  type: 'task',
  key,
  rank: id,
  fields: { title: `Card ${id.toUpperCase()}`, ...fields },
  rev: 1,
  createdAt: key,
  updatedAt: key,
  createdBy: ANA,
  updatedBy: ANA,
});
const SAM: SessionFacilitator = { id: 'k-sam', name: 'Sam', color: '#0ea5e9' };
const TAB = { id: 't1', name: 'Stand-up', elements: [] } as unknown as Tab;
const SETUP: SessionSetup = { typeIds: ['task'], statuses: ['doing', 'review'] };
const NAMES = new Map([
  ['todo', 'To Do'],
  ['doing', 'Doing'],
  ['review', 'Review'],
  ['done', 'Done'],
]);

let root: HTMLElement;
beforeEach(() => {
  vi.mocked(recordSessionOutcome).mockClear();
  vi.mocked(track).mockClear();
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  root = document.createElement('div');
  root.setAttribute('data-canvas-a11y-root', '');
  document.body.append(root);
});
afterEach(() => {
  cleanup();
  root.remove();
  vi.useRealTimers();
});

function mount(opts: {
  mayEdit: boolean;
  canComment?: boolean;
  session?: Partial<SessionTabState>;
  setup?: Partial<SessionSetup>;
  refuse?: boolean;
}) {
  const items = new Map(
    [
      card('a', 1, { status: 'doing', assignee: ANA }),
      card('b', 2, { status: 'review', assignee: ANA }),
      card('c', 3, { status: 'doing', assignee: BO }),
      card('d', 4, { status: 'doing' }),
      // Not in flight: left out.
      card('e', 5, { status: 'todo', assignee: ANA }),
    ].map((i) => [i.id, i]),
  );
  const plan = {
    items,
    types: [task],
    statusNames: NAMES,
    statusPhases: new Map(),
    people: [ANA, BO],
    canEditCards: opts.mayEdit,
    moveItem: vi.fn((id: string, to: { status: string }) => {
      const was = items.get(id)!;
      items.set(id, { ...was, fields: { ...was.fields, status: to.status } });
      (plan as unknown as { items: Map<string, Item> }).items = new Map(items);
    }),
    patchItem: vi.fn(async (id: string, p: { set?: Item['fields'] }) => {
      const was = items.get(id)!;
      items.set(id, { ...was, fields: { ...was.fields, ...p.set } });
      (plan as unknown as { items: Map<string, Item> }).items = new Map(items);
      return true;
    }),
    openItem: vi.fn(),
    announce: vi.fn(),
    itemsScope: { projectId: PLAN },
  } as unknown as PlanContextValue;
  let state: SessionTabState = {
    ...newSessionTab('standup', { ...SETUP, ...opts.setup }),
    ...opts.session,
  };
  const view = { rerender: (() => {}) as (s: SessionTabState) => void };
  const actions: SessionTabActions = {
    startSession: vi.fn(),
    changeSetup: vi.fn(),
    runSession: vi.fn((_t: string, change: (s: SessionTabState) => SessionTabState) => {
      state = change(state);
      view.rerender(state);
    }),
  };
  const live = liveThreads(
    [],
    { canComment: opts.canComment ?? opts.mayEdit, projectId: PLAN },
    { refuse: !!opts.refuse },
  );
  const el = (s: SessionTabState) => (
    <live.Live>
      <SessionPage
        tab={TAB}
        session={s}
        plan={plan}
        mayEdit={opts.mayEdit}
        actions={actions}
        self={SAM}
        presence={[]}
      />
    </live.Live>
  );
  const r = render(el(state));
  view.rerender = (s) => r.rerender(el(s));
  view.rerender(state);
  return { plan, items, acts: live.acts, state: () => state, redraw: () => view.rerender(state) };
}

const people = () =>
  screen.getAllByRole('group').filter((g) => g.hasAttribute('data-standup-person'));
const rows = () => within(screen.getByRole('listbox')).getAllByRole('option');
const shownTitle = () => screen.getByRole('heading', { level: 3 }).textContent;
const pressDone = () => {
  fireEvent.click(screen.getByRole('button', { name: /^Done:/ }));
  act(() => {
    vi.advanceTimersByTime(1000);
  });
};

describe('SessionPage: Stand-up', () => {
  it('groups the in-flight cards by person in board order, Unassigned last, the room’s person unfolded', () => {
    mount({ mayEdit: true });
    expect(people().map((g) => g.getAttribute('aria-label'))).toEqual([
      'Ana Diaz, 2 cards',
      'Bo Lee, 1 card',
      'Unassigned, 1 card',
    ]);
    expect(screen.getByRole('heading', { level: 2 }).textContent).toContain('1 of 3 people');
    expect(screen.getByRole('progressbar').getAttribute('aria-label')).toBe(
      'Stand-up progress, 0 of 3 people done',
    );
    const options = rows();
    expect(options.map((o) => o.textContent)).toEqual([
      expect.stringContaining('Doing'),
      expect.stringContaining('Review'),
    ]);
    expect(shownTitle()).toBe('Card A');
    expect(screen.getByText('Ana Diaz · card 1 of 2')).toBeTruthy();
    // Bo's row unfolds on this screen; folding Ana's hides her cards.
    fireEvent.click(within(people()[1]!).getByRole('button', { name: /Bo Lee/ }));
    expect(rows()).toHaveLength(3);
    fireEvent.click(within(people()[0]!).getByRole('button', { name: /Ana Diaz/ }));
    expect(rows()).toHaveLength(1);
  });

  it('Done records Discussed on each of the person’s cards, moves nothing and moves on to the next person', () => {
    const f = mount({ mayEdit: true });
    pressDone();
    expect(recordSessionOutcome).toHaveBeenCalledWith({ projectId: PLAN }, 'a', {
      session: 'standup',
      outcome: 'discussed',
    });
    expect(recordSessionOutcome).toHaveBeenCalledWith({ projectId: PLAN }, 'b', {
      session: 'standup',
      outcome: 'discussed',
    });
    expect(f.plan.moveItem).not.toHaveBeenCalled();
    expect(track).toHaveBeenCalledWith('Plan', 'Used', 'SessionDiscussed');
    expect(f.state().peopleDone).toEqual({ 'p-ana': { at: expect.any(Number), by: 'Sam' } });
    expect(shownTitle()).toBe('Card C');
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('1');
    expect(people()[0]!.getAttribute('aria-label')).toBe('Ana Diaz, 2 cards, done');
  });

  it('keeps the timebox running across a person’s cards and restarts it for the next person', () => {
    const f = mount({ mayEdit: true, setup: { timeboxMs: 120_000 } });
    expect(f.state().cardStartedAt).toBe(NOW);
    vi.setSystemTime(NOW + 30_000);
    fireEvent.keyDown(window, { key: 'j' });
    expect(f.state().currentId).toBe('b');
    expect(f.state().cardStartedAt).toBe(NOW);
    vi.setSystemTime(NOW + 60_000);
    pressDone();
    expect(f.state().currentId).toBe('c');
    expect(f.state().cardStartedAt).toBeGreaterThanOrEqual(NOW + 60_000);
  });

  it('Blocked asks a reason in a dialog, flags the real card, comments it and keeps the room on it', async () => {
    const f = mount({ mayEdit: true });
    fireEvent.keyDown(window, { key: 'b' });
    const dialog = screen.getByRole('dialog', { name: 'Mark Blocked' });
    const confirm = within(dialog).getByRole('button', { name: 'Mark Blocked' });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Waiting on Review' }));
    await act(async () => {
      fireEvent.click(confirm);
    });
    expect(f.plan.patchItem).toHaveBeenCalledWith('a', { set: { flagged: true } });
    expect(f.acts[0]).toEqual({
      kind: 'start',
      itemId: 'a',
      text: 'Blocked: Waiting on Review',
      title: 'Stand-up, 11 Apr',
    });
    expect(recordSessionOutcome).toHaveBeenCalledWith({ projectId: PLAN }, 'a', {
      session: 'standup',
      outcome: 'flagged',
      reason: 'Waiting on Review',
    });
    expect(f.state().decided?.a).toMatchObject({
      outcome: 'flagged',
      flagSet: true,
      reason: 'Waiting on Review',
    });
    expect(f.state().currentId).toBe('a');
    expect(screen.getByText('Ana Diaz · card 1 of 2 · Blocked: Waiting on Review')).toBeTruthy();
    // Flagged now: Blocked is not offered again, and B does nothing.
    expect(screen.queryByRole('button', { name: /Blocked/ })).toBeNull();
    // Undo Last takes the flag back off.
    fireEvent.click(screen.getByRole('button', { name: 'Undo Flagged WI-1' }));
    expect(f.plan.patchItem).toHaveBeenCalledWith('a', { clear: ['flagged'] });
    expect(f.state().decided).toBeUndefined();
  });

  it('Stage moves the real card and keeps it queued; Undo Last moves it back', () => {
    const f = mount({ mayEdit: true });
    fireEvent.change(screen.getByRole('combobox', { name: 'Stage of WI-1' }), {
      target: { value: 'done' },
    });
    expect(f.plan.moveItem).toHaveBeenCalledWith('a', { status: 'done', before: null });
    expect(f.state().decided?.a).toMatchObject({ outcome: 'discussed', from: 'doing', to: 'done' });
    f.redraw();
    // Out of the picked stages, still queued and still the room's card.
    expect(shownTitle()).toBe('Card A');
    fireEvent.click(screen.getByRole('button', { name: 'Undo Moved WI-1' }));
    expect(f.plan.moveItem).toHaveBeenLastCalledWith(
      'a',
      expect.objectContaining({ status: 'doing' }),
    );
    expect(f.state().decided).toBeUndefined();
  });

  it('Blocked then Stage are two steps: U takes back the move, a second U the flag', async () => {
    const f = mount({ mayEdit: true });
    fireEvent.keyDown(window, { key: 'b' });
    fireEvent.click(screen.getByRole('button', { name: 'Waiting on Review' }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Mark Blocked' }));
    });
    f.redraw();
    vi.setSystemTime(NOW + 1_000);
    fireEvent.change(screen.getByRole('combobox', { name: 'Stage of WI-1' }), {
      target: { value: 'done' },
    });
    f.redraw();
    vi.mocked(recordSessionOutcome).mockClear();
    expect(screen.getByRole('button', { name: 'Undo Moved WI-1' })).toBeTruthy();
    fireEvent.keyDown(window, { key: 'u' });
    expect(f.plan.moveItem).toHaveBeenLastCalledWith(
      'a',
      expect.objectContaining({ status: 'doing' }),
    );
    expect(f.plan.patchItem).not.toHaveBeenCalledWith('a', { clear: ['flagged'] });
    expect(recordSessionOutcome).not.toHaveBeenCalled();
    expect(f.state().decided?.a).toMatchObject({ outcome: 'flagged', reason: 'Waiting on Review' });
    expect(f.state().decided?.a?.from).toBeUndefined();
    f.redraw();
    expect(screen.getByRole('button', { name: 'Undo Flagged WI-1' })).toBeTruthy();
    fireEvent.keyDown(window, { key: 'u' });
    expect(f.plan.patchItem).toHaveBeenCalledWith('a', { clear: ['flagged'] });
    expect(recordSessionOutcome).toHaveBeenCalledWith({ projectId: PLAN }, 'a', {
      session: 'standup',
      outcome: 'flagged',
      undone: true,
    });
    expect(f.state().decided).toBeUndefined();
  });

  it('U undoes a Done: the person no longer Done, the Discussed taken back, the room back on them', () => {
    const f = mount({ mayEdit: true });
    pressDone();
    vi.mocked(recordSessionOutcome).mockClear();
    fireEvent.keyDown(window, { key: 'u' });
    expect(f.state().peopleDone).toBeUndefined();
    expect(f.state().decided).toBeUndefined();
    expect(f.state().currentId).toBe('a');
    expect(recordSessionOutcome).toHaveBeenCalledWith({ projectId: PLAN }, 'a', {
      session: 'standup',
      outcome: 'discussed',
      undone: true,
    });
    expect(track).toHaveBeenCalledWith('Plan', 'Used', 'SessionUndone');
  });

  it('a Done person’s card offers Undo Done', () => {
    const f = mount({ mayEdit: true });
    pressDone();
    fireEvent.click(within(people()[0]!).getByRole('button', { name: /Ana Diaz/ }));
    fireEvent.click(rows()[0]!);
    expect(screen.getByText('Ana Diaz done by Sam')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Undo Done' }));
    expect(f.state().peopleDone).toBeUndefined();
  });

  it('ends on Session Complete listing the blockers, each opening its card', async () => {
    const f = mount({ mayEdit: true });
    fireEvent.click(screen.getByRole('button', { name: /Blocked/ }));
    fireEvent.change(screen.getByRole('textbox', { name: /in the way/ }), {
      target: { value: 'Keys' },
    });
    await act(async () => {
      fireEvent.keyDown(screen.getByRole('textbox', { name: /in the way/ }), { key: 'Enter' });
    });
    pressDone();
    pressDone();
    pressDone();
    expect(f.state().peopleDone).toBeDefined();
    expect(screen.getByText('Session Complete')).toBeTruthy();
    const blocker = screen.getByRole('button', { name: /Card A/ });
    expect(blocker.textContent).toContain('Ana Diaz · Keys');
    fireEvent.click(blocker);
    expect(shownTitle()).toBe('Card A');
    fireEvent.click(screen.getByRole('button', { name: 'Back to Summary' }));
    expect(screen.getByText('Session Complete')).toBeTruthy();
  });

  it('a Participant comments in the day’s thread but runs nothing; a Viewer has no comment strip', async () => {
    const f = mount({ mayEdit: false, canComment: true });
    expect(screen.getByText('Nobody is running this session')).toBeTruthy();
    expect(
      screen.getByRole('link', { name: 'Learn about stand-up sessions' }).getAttribute('href'),
    ).toBe('/help/plan/session-tabs/stand-up/');
    expect(screen.queryByRole('button', { name: /^Done:/ })).toBeNull();
    const box = screen.getByRole('textbox', { name: 'Comment on WI-1' });
    fireEvent.change(box, { target: { value: 'Pairing on it today' } });
    await act(async () => {
      fireEvent.keyDown(box, { key: 'Enter' });
    });
    expect(f.acts[0]).toEqual({
      kind: 'start',
      itemId: 'a',
      text: 'Pairing on it today',
      title: 'Stand-up, 11 Apr',
    });
    // A press on a row is a peek.
    fireEvent.click(rows()[1]!);
    expect(shownTitle()).toBe('Card B');
    expect(f.state().currentId).toBeUndefined();
    cleanup();
    mount({ mayEdit: false, canComment: false });
    expect(screen.queryByRole('textbox', { name: /Comment on/ })).toBeNull();
  });

  it('Session Settings offers People Order in place of Order, with a timebox per person', () => {
    mount({ mayEdit: true, setup: { personOrder: 'alphabetical' } });
    expect(screen.getByText(/Alphabetical/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Session Settings' }));
    expect(screen.getByRole('group', { name: 'People order' })).toBeTruthy();
    expect(screen.queryByRole('combobox', { name: 'Sort By' })).toBeNull();
    expect(screen.getByRole('group', { name: 'Timebox per person' })).toBeTruthy();
    expect(screen.getByText(/4 cards, 3 people/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Shuffled Daily' }));
    expect(screen.getByText(/A fresh order each day/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.queryByRole('group', { name: 'People order' })).toBeNull();
  });

  it('Cancel leaves the card unflagged; K steps back; Start Again clears everyone', () => {
    const f = mount({ mayEdit: true });
    fireEvent.click(screen.getByRole('button', { name: /Blocked/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(f.plan.patchItem).not.toHaveBeenCalled();
    fireEvent.keyDown(window, { key: 'j' });
    fireEvent.keyDown(window, { key: 'k' });
    expect(f.state().currentId).toBe('a');
    pressDone();
    pressDone();
    pressDone();
    expect(screen.getByText('No blockers today.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Start Again' }));
    expect(f.state().peopleDone).toBeUndefined();
    expect(shownTitle()).toBe('Card A');
  });

  it('keeps a typed comment when the write is refused', async () => {
    mount({ mayEdit: true, refuse: true });
    const box = screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Comment on WI-1' });
    fireEvent.change(box, { target: { value: 'Lost?' } });
    await act(async () => {
      fireEvent.keyDown(box, { key: 'Enter' });
    });
    expect(box.value).toBe('Lost?');
  });
});
