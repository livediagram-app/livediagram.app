// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Item, ItemTypeDef } from '@liveplanner/items';
import {
  newSessionTab,
  type SessionFacilitator,
  type SessionTabState,
  type Tab,
} from '@liveplanner/project';
import type { PlanContextValue } from '@/components/plan/PlanContext';
import type { SessionTabActions } from '@/hooks/plan/useSessionTabActions';

const phone = vi.hoisted(() => ({ on: false }));
vi.mock('@liveworkspace/workbench/hooks/ui/useIsMobileViewport', () => ({
  useIsMobileViewport: () => phone.on,
}));
vi.mock('@/hooks/ui/useCanvasLayerInsets', () => ({ useCanvasLayerInsets: () => ({}) }));
vi.mock('@/components/plan/CanvasCover', () => ({
  CanvasCover: ({ children }: { children: React.ReactNode }) => (
    <div data-session-page="">{children}</div>
  ),
}));
vi.mock('@/components/plan/dashboard/DashboardMenuName', () => ({
  DashboardMenuName: (p: { onRename?: (n: string) => void }) =>
    p.onRename ? (
      <button type="button" onClick={() => p.onRename!('Grooming')}>
        Rename
      </button>
    ) : null,
}));
vi.mock('./SessionCard', () => ({
  SessionCard: ({ item }: { item: Item }) => <h3>{item.fields.title as string}</h3>,
}));
vi.mock('@/lib/api/item-history', () => ({ recordSessionOutcome: vi.fn(async () => {}) }));
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
vi.mock('./session-chime', () => ({ playSessionChime: vi.fn() }));

import { SessionPage } from './SessionPage';

// docs/specs/026-plan/session-tabs.md "The page", "Share roles": the queue beside the room's card, the facilitator's
// verbs, a peek for anyone else, the phone's fold-down queue, Session Settings and the end of the session.
const work: ItemTypeDef = {
  id: 'work',
  label: 'Work',
  newTitle: 'New work',
  glyph: 'task',
  color: '#7c3aed',
  fields: ['title', 'status'],
  statuses: ['backlog', 'ready'],
};
const card = (id: string): Item => ({
  id,
  type: 'work',
  key: 1,
  rank: id,
  fields: { title: `Card ${id.toUpperCase()}`, status: 'backlog' },
  rev: 1,
  createdAt: 0,
  updatedAt: 0,
  createdBy: { id: 'p', name: 'P', color: '#000' },
  updatedBy: { id: 'p', name: 'P', color: '#000' },
});
const SAM: SessionFacilitator = { id: 'k-sam', name: 'Sam', color: '#0ea5e9' };
const ALI: SessionFacilitator = { id: 'k-ali', name: 'Ali', color: '#dc2626' };
const TAB = { id: 't1', name: 'Refinement', elements: [] } as unknown as Tab;

let root: HTMLElement;
beforeEach(() => {
  phone.on = false;
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
  session?: Partial<SessionTabState>;
  items?: Item[];
  self?: SessionFacilitator;
}) {
  const items = new Map((opts.items ?? [card('a'), card('b')]).map((i) => [i.id, i]));
  const plan = {
    items,
    types: [work],
    statusNames: new Map([
      ['backlog', 'Backlog'],
      ['ready', 'Ready'],
    ]),
    moveItem: vi.fn(),
    patchItem: vi.fn(async () => true),
    announce: vi.fn(),
    itemsScope: null,
  } as unknown as PlanContextValue;
  let state: SessionTabState = {
    ...newSessionTab('refinement', { typeIds: ['work'], statuses: ['backlog'] }),
    ...opts.session,
  };
  const view = { rerender: (() => {}) as (s: SessionTabState) => void };
  const actions: SessionTabActions = {
    startSession: vi.fn(),
    changeSetup: vi.fn(),
    runSession: vi.fn((_t, change) => {
      state = change(state);
      view.rerender(state);
    }),
  };
  const renameTab = vi.fn();
  const el = (s: SessionTabState) => (
    <SessionPage
      tab={TAB}
      session={s}
      plan={plan}
      mayEdit={opts.mayEdit}
      actions={actions}
      self={opts.self ?? SAM}
      presence={[]}
      renameTab={renameTab}
    />
  );
  const r = render(el(state));
  view.rerender = (s) => r.rerender(el(s));
  // What the first render's effects ran (the baton, the room's card) shows once it has mounted.
  view.rerender(state);
  return { actions, renameTab, plan, state: () => state };
}

describe('SessionPage', () => {
  it('an Editor opening it takes the baton, sees the queue and the room’s card, and runs it', () => {
    const f = mount({ mayEdit: true });
    expect(screen.getByText(/are facilitating/).textContent).toBe('You are facilitating');
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Refinement1 of 2');
    expect(screen.getByRole('heading', { level: 3, name: 'Card A' })).toBeTruthy();
    expect(
      within(screen.getByRole('complementary', { name: 'Refinement queue' })).getAllByRole(
        'option',
      ),
    ).toHaveLength(2);
    fireEvent.keyDown(window, { key: 's' });
    expect(f.state().decided?.a?.outcome).toBe('skipped');
    expect(screen.getByRole('heading', { level: 3, name: 'Card B' })).toBeTruthy();
    // The keys work for the facilitator.
    fireEvent.keyDown(window, { key: 'f' });
    expect(f.state().decided?.b?.outcome).toBe('flagged');
    // Both decided: the session is complete, with Review Skipped.
    expect(screen.getByRole('heading', { name: 'Session Complete' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Review Skipped' }));
    expect(screen.getByRole('heading', { level: 3, name: 'Card A' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Undo Outcome' }));
    expect(f.state().decided?.a).toBeUndefined();
    fireEvent.click(screen.getByRole('button', { name: 'Rename' }));
    expect(f.renameTab).toHaveBeenCalledWith('t1', 'Grooming');
  });

  it('Refined clicked by R moves the card to its target', () => {
    vi.useFakeTimers();
    try {
      const f = mount({ mayEdit: true });
      fireEvent.keyDown(window, { key: 'r' });
      // The fill plays first; the card moves at its end.
      expect(f.plan.moveItem).not.toHaveBeenCalled();
      act(() => {
        vi.runAllTimers();
      });
      expect(f.plan.moveItem).toHaveBeenCalledWith('a', { status: 'ready', before: null });
    } finally {
      vi.useRealTimers();
    }
  });

  it('Session Settings saves the set-up in place', () => {
    const f = mount({ mayEdit: true });
    fireEvent.click(screen.getByRole('button', { name: 'Session Settings' }));
    expect(screen.getByRole('heading', { name: 'Session Settings' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(f.actions.changeSetup).toHaveBeenCalledWith({
      typeIds: ['work'],
      statuses: ['backlog'],
    });
    expect(screen.queryByRole('heading', { name: 'Session Settings' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Session Settings' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('heading', { name: 'Session Settings' })).toBeNull();
    cleanup();
    // An empty set-up offers its Session Settings in the page too.
    mount({ mayEdit: true, items: [] });
    fireEvent.click(screen.getAllByRole('button', { name: 'Session Settings' }).at(-1)!);
    expect(screen.getByRole('heading', { name: 'Session Settings' })).toBeTruthy();
  });

  it('a Participant or Viewer sees who runs it, no verbs, and a peek with Back to their card', () => {
    const f = mount({
      mayEdit: false,
      session: { facilitator: ALI, currentId: 'a', cardStartedAt: 1 },
    });
    expect(screen.getByRole('status').textContent).toBe('Ali is running this session');
    expect(
      screen.queryByRole('button', { name: /Skip|Flag|Refined|Session Settings|Rename/ }),
    ).toBeNull();
    fireEvent.click(screen.getAllByRole('option')[1]!);
    expect(screen.getByText('You are looking at another card.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Back to Ali’s Card' }));
    expect(screen.getByRole('heading', { level: 3, name: 'Card A' })).toBeTruthy();
    expect(f.actions.runSession).not.toHaveBeenCalled();
    cleanup();
    mount({ mayEdit: false, session: { currentId: 'a', cardStartedAt: 1 } });
    fireEvent.click(screen.getAllByRole('option')[1]!);
    expect(screen.getByRole('button', { name: 'Back to the Room’s Card' })).toBeTruthy();
  });

  it('a phone folds the queue away, and again once a card is opened from it', () => {
    phone.on = true;
    mount({ mayEdit: true });
    expect(screen.queryByRole('option')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Queue/ }));
    expect(screen.getByRole('button', { name: /Queue/ }).textContent).toBe('QueueHide');
    fireEvent.click(screen.getAllByRole('option')[1]!);
    expect(screen.queryByRole('option')).toBeNull();
    expect(screen.getByRole('heading', { level: 3, name: 'Card B' })).toBeTruthy();
  });

  it('an empty set-up says so; a time up says so; a long queue says it shows the first cards', () => {
    mount({ mayEdit: false, items: [] });
    expect(screen.getAllByRole('heading', { level: 2 })[0]!.textContent).toBe('Refinement');
    expect(screen.queryByRole('button', { name: 'Session Settings' })).toBeNull();
    cleanup();
    mount({
      mayEdit: false,
      session: {
        setup: { typeIds: ['work'], statuses: ['backlog'], timeboxMs: 60_000 },
        currentId: 'a',
        cardStartedAt: 1,
      },
      items: Array.from({ length: 501 }, (_, i) => card(`c${String(i).padStart(3, '0')}`)).concat(
        card('a'),
      ),
    });
    expect(screen.getByText('Time’s up')).toBeTruthy();
    expect(screen.getByText('Showing the first 500 cards.')).toBeTruthy();
  });

  it('a card in its type’s last stage stays there, and a stage the plan has no name for shows its id', () => {
    const last = { ...card('z'), fields: { title: 'Card Z', status: 'ready' } };
    const odd = { ...card('y'), fields: { title: 'Card Y', status: 'limbo' } };
    mount({
      mayEdit: true,
      items: [last, odd],
      session: { setup: { typeIds: ['work'], statuses: ['ready', 'limbo'] } },
    });
    expect(screen.getByText(/its type has no later stage/).textContent).toContain('Stays in limbo');
    fireEvent.keyDown(window, { key: 'j' });
    expect(screen.getByText(/its type has no later stage/).textContent).toContain('Stays in Ready');
  });

  it('draws nothing over the canvas until the canvas is there', () => {
    root.remove();
    mount({ mayEdit: true });
    expect(document.querySelector('[data-session-page]')).toBeNull();
  });
});
