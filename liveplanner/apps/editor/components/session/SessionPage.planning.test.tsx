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

// docs/specs/026-plan/session-tabs.md "Sprint Planning", "Share roles": Commit moves the real card and records it,
// Skip greys it and moves on, the Estimate strip writes the card, and the tally follows the committed estimates.
const feature: ItemTypeDef = {
  id: 'feature',
  label: 'Feature',
  newTitle: 'New feature',
  glyph: 'task',
  color: '#7c3aed',
  fields: ['title', 'status', 'estimate'],
  statuses: ['reviewed', 'selected', 'done'],
};
const card = (id: string, estimate?: number): Item => ({
  id,
  type: 'feature',
  key: 1,
  rank: id,
  fields: {
    title: `Card ${id.toUpperCase()}`,
    status: 'reviewed',
    ...(estimate === undefined ? {} : { estimate }),
  },
  rev: 1,
  createdAt: 0,
  updatedAt: 0,
  createdBy: { id: 'p', name: 'P', color: '#000' },
  updatedBy: { id: 'p', name: 'P', color: '#000' },
});
const SAM: SessionFacilitator = { id: 'k-sam', name: 'Sam', color: '#0ea5e9' };
const ALI: SessionFacilitator = { id: 'k-ali', name: 'Ali', color: '#dc2626' };
const TAB = { id: 't1', name: 'Sprint Planning', elements: [] } as unknown as Tab;
const SETUP: SessionSetup = { typeIds: ['feature'], statuses: ['reviewed'], capacity: 10 };

let root: HTMLElement;
beforeEach(() => {
  vi.mocked(recordSessionOutcome).mockClear();
  vi.mocked(track).mockClear();
  root = document.createElement('div');
  root.setAttribute('data-canvas-a11y-root', '');
  document.body.append(root);
});
afterEach(() => {
  cleanup();
  root.remove();
});

function mount(opts: {
  mayEdit: boolean;
  canEditCards?: boolean;
  session?: Partial<SessionTabState>;
  items?: Item[];
  types?: ItemTypeDef[];
  statusNames?: Map<string, string>;
}) {
  const items = new Map(
    (opts.items ?? [card('a', 5), card('b', 8), card('c')]).map((i) => [i.id, i]),
  );
  const plan = {
    items,
    types: opts.types ?? [feature],
    statusNames:
      opts.statusNames ??
      new Map([
        ['reviewed', 'Reviewed'],
        ['selected', 'Selected'],
        ['done', 'Done'],
      ]),
    canEditCards: opts.canEditCards ?? opts.mayEdit,
    moveItem: vi.fn(),
    patchItem: vi.fn(async () => true),
    announce: vi.fn(),
    itemsScope: { projectId: 'p1' },
  } as unknown as PlanContextValue;
  let state: SessionTabState = { ...newSessionTab('planning', SETUP), ...opts.session };
  const view = { rerender: (() => {}) as (s: SessionTabState) => void };
  const actions: SessionTabActions = {
    startSession: vi.fn(),
    changeSetup: vi.fn(),
    runSession: vi.fn((_t: string, change: (s: SessionTabState) => SessionTabState) => {
      state = change(state);
      view.rerender(state);
    }),
  };
  const el = (s: SessionTabState) => (
    <SessionPage
      tab={TAB}
      session={s}
      plan={plan}
      mayEdit={opts.mayEdit}
      actions={actions}
      self={SAM}
      presence={[]}
    />
  );
  const r = render(el(state));
  view.rerender = (s) => r.rerender(el(s));
  view.rerender(state);
  return { plan, actions, state: () => state };
}

const tallyState = () =>
  document.querySelector('[data-tally-state]')?.getAttribute('data-tally-state');

describe('SessionPage: Sprint Planning', () => {
  it('Commit plays the fill, moves the real card, records it and tallies its estimate', () => {
    vi.useFakeTimers();
    try {
      const f = mount({ mayEdit: true });
      expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Sprint Planning1 of 3');
      expect(screen.getByText(/Moves to/).textContent).toBe('Moves to Selected');
      // No Flag in a Sprint Planning session; the fill button is Commit.
      expect(screen.queryByRole('button', { name: /Flag/ })).toBeNull();
      expect(screen.getByRole('meter').getAttribute('aria-valuetext')).toBe('0 of 10 points');
      expect(screen.getByText('5 of 10').parentElement?.textContent).toBe(
        'Commit makes it 5 of 10',
      );
      fireEvent.click(screen.getByRole('button', { name: /Commit/ }));
      expect(f.plan.moveItem).not.toHaveBeenCalled();
      act(() => {
        vi.runAllTimers();
      });
      expect(f.plan.moveItem).toHaveBeenCalledWith('a', { status: 'selected', before: null });
      expect(recordSessionOutcome).toHaveBeenCalledWith({ projectId: 'p1' }, 'a', {
        session: 'planning',
        outcome: 'committed',
      });
      expect(track).toHaveBeenCalledWith('Plan', 'Used', 'SessionCommitted');
      expect(f.state().decided?.a?.outcome).toBe('committed');
      expect(screen.getByRole('meter').getAttribute('aria-valuetext')).toBe('5 of 10 points');
      expect(screen.getByRole('heading', { level: 3, name: 'Card B' })).toBeTruthy();
      // B's 8 would make it 13 of 10: the meter still offers Commit, never blocking it.
      expect(screen.getByText('13 of 10')).toBeTruthy();
      fireEvent.keyDown(window, { key: 'c' });
      act(() => {
        vi.runAllTimers();
      });
      expect(f.state().decided?.b?.outcome).toBe('committed');
      expect(tallyState()).toBe('over');
      expect(screen.getAllByText('Over capacity by 3 points').length).toBeGreaterThan(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('on a Sprint Board, where Ready comes after Done, Commit moves a Ready card to To Do', () => {
    vi.useFakeTimers();
    try {
      const story = { ...feature, statuses: ['todo', 'doing', 'done', 'backlog', 'ready'] };
      const ready = { ...card('a', 3), fields: { title: 'Card A', status: 'ready', estimate: 3 } };
      const f = mount({
        mayEdit: true,
        types: [story],
        items: [ready],
        statusNames: new Map([
          ['todo', 'To Do'],
          ['doing', 'Doing'],
          ['done', 'Done'],
          ['backlog', 'Backlog'],
          ['ready', 'Ready'],
        ]),
        session: { setup: { typeIds: ['feature'], statuses: ['ready'] } },
      });
      expect(screen.getByText(/Moves to/).textContent).toBe('Moves to To Do');
      fireEvent.keyDown(window, { key: 'c' });
      act(() => {
        vi.runAllTimers();
      });
      expect(f.plan.moveItem).toHaveBeenCalledWith('a', { status: 'todo', before: null });
    } finally {
      vi.useRealTimers();
    }
  });

  it('Skip greys the card and moves on; a committed card with no estimate counts apart', () => {
    const f = mount({ mayEdit: true });
    fireEvent.keyDown(window, { key: 's' });
    expect(f.state().decided?.a?.outcome).toBe('skipped');
    const rows = within(screen.getByRole('listbox')).getAllByRole('option');
    expect(rows[0]!.className).toContain('opacity-60');
    expect(rows[0]!.textContent).toContain('Skipped');
    expect(screen.getByRole('heading', { level: 3, name: 'Card B' })).toBeTruthy();
    fireEvent.keyDown(window, { key: 'j' });
    expect(screen.getByRole('heading', { level: 3, name: 'Card C' })).toBeTruthy();
    expect(screen.getByText('No estimate: Commit counts it apart')).toBeTruthy();
    expect(rows.at(-1)!.textContent).toContain('No estimate');
    cleanup();
    mount({
      mayEdit: true,
      session: { decided: { c: { outcome: 'committed', at: 1, by: 'Sam' } } },
    });
    expect(screen.getByText('1 committed card has no estimate, not counted')).toBeTruthy();
    expect(screen.getByRole('meter').getAttribute('aria-valuetext')).toBe('0 of 10 points');
  });

  it('the Estimate strip writes the card’s estimate, or clears it', () => {
    const f = mount({ mayEdit: true });
    fireEvent.click(screen.getByRole('button', { name: '13' }));
    fireEvent.click(screen.getByRole('button', { name: 'None' }));
    expect(vi.mocked(f.plan.patchItem).mock.calls).toEqual([
      ['a', { set: { estimate: 13 } }],
      ['a', { clear: ['estimate'] }],
    ]);
  });

  it('a Participant sets estimates but never commits; a Viewer reads them', () => {
    const p = mount({
      mayEdit: false,
      canEditCards: true,
      session: { facilitator: ALI, currentId: 'a', cardStartedAt: 1 },
    });
    expect(screen.queryByRole('button', { name: /Commit|Skip/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '3' }));
    expect(p.plan.patchItem).toHaveBeenCalledWith('a', { set: { estimate: 3 } });
    fireEvent.keyDown(window, { key: 'c' });
    expect(p.actions.runSession).not.toHaveBeenCalled();
    expect(screen.getByText(/Commit makes it/)).toBeTruthy();
    // A peek at another card sets its estimate too, with no Commit preview.
    fireEvent.click(screen.getAllByRole('option')[1]!);
    expect(screen.getByRole('heading', { level: 3, name: 'Card B' })).toBeTruthy();
    expect(screen.queryByText(/Commit makes it/)).toBeNull();
    cleanup();
    mount({
      mayEdit: false,
      canEditCards: false,
      session: { facilitator: ALI, currentId: 'a', cardStartedAt: 1 },
    });
    expect(screen.queryByRole('group', { name: 'Estimate' })).toBeNull();
    expect(document.querySelector('[data-estimate-strip]')?.textContent).toContain('5');
  });

  it('Session Complete shows Committed and Skipped with the tally', () => {
    mount({
      mayEdit: true,
      items: [card('a', 5)],
      session: { decided: { a: { outcome: 'committed', at: 1, by: 'Sam' } } },
    });
    expect(screen.getByRole('heading', { name: 'Session Complete' })).toBeTruthy();
    expect(screen.getAllByRole('term').map((t) => t.textContent)).toEqual(['Committed', 'Skipped']);
    expect(screen.getByText(/committed$/).textContent).toBe('5 of 10 points committed');
  });
});
