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

// docs/specs/026-plan/session-tabs.md "Bug Triage", "Share roles": Accept and Close move the real card and record it
// (Close with its reason and duplicate, linked through the type's Duplicate Of field), each row shows its card's
// priority (set in the card's Details, no strip above the bar), and Undo takes a decision back.
const bug: ItemTypeDef = {
  id: 'bug',
  label: 'Bug',
  newTitle: 'New bug',
  glyph: 'bug',
  color: '#dc2626',
  prefix: 'BUG',
  fields: ['title', 'status', 'priority', 'f-sev', 'f-dup'],
  statuses: ['new', 'needs-info', 'confirmed', 'wont-fix', 'duplicate'],
  custom: [
    { id: 'f-sev', label: 'Severity', kind: 'choice', options: ['Low', 'High', 'Critical'] },
    { id: 'f-dup', label: 'Duplicate Of', kind: 'card', linkType: 'bug' },
  ],
};
const card = (id: string, key: number, status = 'new', fields: Item['fields'] = {}): Item => ({
  id,
  type: 'bug',
  key,
  rank: id,
  fields: { title: `Card ${id.toUpperCase()}`, status, ...fields },
  rev: 1,
  createdAt: key,
  updatedAt: 0,
  createdBy: { id: 'p', name: 'P', color: '#000' },
  updatedBy: { id: 'p', name: 'P', color: '#000' },
});
const SAM: SessionFacilitator = { id: 'k-sam', name: 'Sam', color: '#0ea5e9' };
const ALI: SessionFacilitator = { id: 'k-ali', name: 'Ali', color: '#dc2626' };
const TAB = { id: 't1', name: 'Bug Triage', elements: [] } as unknown as Tab;
const SETUP: SessionSetup = {
  typeIds: ['bug'],
  statuses: ['new'],
  sortBy: [{ field: 'createdAt', dir: 'asc' }],
};
const NAMES = new Map([
  ['new', 'New'],
  ['needs-info', 'Needs Info'],
  ['confirmed', 'Confirmed'],
  ['wont-fix', 'Won’t Fix'],
  ['duplicate', 'Duplicate'],
]);

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
}) {
  const items = new Map(
    (
      opts.items ?? [
        card('a', 1, 'new', { priority: 'high' }),
        card('b', 2),
        card('c', 3),
        card('z', 9, 'confirmed'),
      ]
    ).map((i) => [i.id, i]),
  );
  const plan = {
    items,
    types: [bug],
    statusNames: NAMES,
    canEditCards: opts.canEditCards ?? opts.mayEdit,
    // The move lands on the card, as the store's optimistic write does.
    moveItem: vi.fn((id: string, move: { status: string }) => {
      const was = items.get(id)!;
      items.set(id, { ...was, fields: { ...was.fields, status: move.status } });
    }),
    patchItem: vi.fn(async () => true),
    announce: vi.fn(),
    itemsScope: { projectId: 'p1' },
  } as unknown as PlanContextValue;
  let state: SessionTabState = { ...newSessionTab('triage', SETUP), ...opts.session };
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
  return { plan, items, actions, state: () => state, rerender: () => view.rerender(state) };
}

const closeBug = () => screen.getByRole<HTMLButtonElement>('button', { name: 'Close Bug' });

describe('SessionPage: Bug Triage', () => {
  it('Accept plays the fill, moves the card past Needs Info to Confirmed and records it', () => {
    vi.useFakeTimers();
    try {
      const f = mount({ mayEdit: true });
      expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Bug Triage1 of 3');
      expect(screen.getByText(/moves to/).textContent).toBe('Accept moves to Confirmed');
      fireEvent.click(screen.getByRole('button', { name: /Accept/ }));
      act(() => {
        vi.runAllTimers();
      });
      expect(f.plan.moveItem).toHaveBeenCalledWith('a', { status: 'confirmed', before: null });
      expect(recordSessionOutcome).toHaveBeenCalledWith({ projectId: 'p1' }, 'a', {
        session: 'triage',
        outcome: 'accepted',
      });
      expect(track).toHaveBeenCalledWith('Plan', 'Used', 'SessionAccepted');
      expect(f.state().decided?.a).toMatchObject({
        outcome: 'accepted',
        from: 'new',
        to: 'confirmed',
      });
      expect(screen.getByRole('heading', { level: 3, name: 'Card B' })).toBeTruthy();
      fireEvent.keyDown(window, { key: 'a' });
      act(() => {
        vi.runAllTimers();
      });
      expect(f.state().decided?.b?.outcome).toBe('accepted');
    } finally {
      vi.useRealTimers();
    }
  });

  it('Close asks a reason, links a duplicate, moves the card to Duplicate and records both', () => {
    const f = mount({ mayEdit: true });
    fireEvent.keyDown(window, { key: 'c' });
    const tray = screen.getByRole('dialog', { name: 'Close Bug' });
    expect(closeBug().disabled).toBe(true);
    expect(within(tray).getByText(/Moves to/).textContent).toBe('Moves to Won’t Fix');
    // Keys never decide while the dialog asks its reason.
    fireEvent.keyDown(window, { key: 's' });
    expect(f.state().decided).toBeUndefined();
    fireEvent.click(within(tray).getByRole('button', { name: 'Can’t Reproduce' }));
    expect(screen.getByRole<HTMLInputElement>('textbox', { name: 'Reason' }).value).toBe(
      'Can’t Reproduce',
    );
    fireEvent.click(within(tray).getByRole('button', { name: 'Link Duplicate' }));
    const picker = screen.getByRole('dialog', { name: 'Link Duplicate' });
    // The card itself is never offered.
    expect(within(picker).queryByRole('button', { name: /Card A/ })).toBeNull();
    fireEvent.click(within(picker).getByRole('button', { name: /Card Z/ }));
    expect(screen.queryByRole('dialog', { name: 'Link Duplicate' })).toBeNull();
    expect(within(tray).getByText(/Moves to/).textContent).toBe('Moves to Duplicate');
    expect(document.querySelector('[data-duplicate-chip="z"]')?.textContent).toContain('BUG-9');
    // A typed reason stays when a duplicate is picked.
    expect(screen.getByRole<HTMLInputElement>('textbox', { name: 'Reason' }).value).toBe(
      'Can’t Reproduce',
    );
    fireEvent.click(closeBug());
    expect(screen.queryByRole('dialog', { name: 'Close Bug' })).toBeNull();
    expect(f.plan.patchItem).toHaveBeenCalledWith('a', { set: { 'f-dup': 'z' } });
    expect(f.plan.moveItem).toHaveBeenCalledWith('a', { status: 'duplicate', before: null });
    expect(recordSessionOutcome).toHaveBeenCalledWith({ projectId: 'p1' }, 'a', {
      session: 'triage',
      outcome: 'closed',
      reason: 'Can’t Reproduce',
      duplicateOf: 'z',
    });
    expect(track).toHaveBeenCalledWith('Plan', 'Used', 'SessionClosed');
    expect(f.state().decided?.a).toMatchObject({
      outcome: 'closed',
      reason: 'Can’t Reproduce',
      duplicateOf: 'z',
      linked: 'f-dup',
      from: 'new',
      to: 'duplicate',
    });
    expect(screen.getByRole('heading', { level: 3, name: 'Card B' })).toBeTruthy();
    // The closed card reads its duplicate and reason when shown again.
    fireEvent.click(screen.getAllByRole('option')[0]!);
    expect(document.querySelector('[data-decision-note]')?.textContent).toBe(
      ' · Duplicate of BUG-9 · Can’t Reproduce',
    );
  });

  it('Undo Last takes a Close back: the card returns, its link comes off, and the undo is recorded', () => {
    const f = mount({ mayEdit: true });
    fireEvent.click(screen.getByRole('button', { name: /^Close$/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Link Duplicate' }));
    fireEvent.click(
      within(screen.getByRole('dialog', { name: 'Link Duplicate' })).getByRole('button', {
        name: /Card Z/,
      }),
    );
    // A picked duplicate fills an empty reason.
    const input = screen.getByRole<HTMLInputElement>('textbox', { name: 'Reason' });
    expect(input.value).toBe('Duplicate of BUG-9');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(f.state().decided?.a?.outcome).toBe('closed');
    // The card as the close left it.
    f.items.set('a', card('a', 1, 'duplicate', { priority: 'high', 'f-dup': 'z' }));
    vi.mocked(f.plan.moveItem).mockClear();
    vi.mocked(f.plan.patchItem).mockClear();
    vi.mocked(recordSessionOutcome).mockClear();
    const chip = screen.getByRole('button', { name: 'Undo Closed BUG-1' });
    fireEvent.click(chip);
    expect(f.plan.moveItem).toHaveBeenCalledWith('a', { status: 'new', before: 'b' });
    expect(f.plan.patchItem).toHaveBeenCalledWith('a', { clear: ['f-dup'] });
    expect(recordSessionOutcome).toHaveBeenCalledWith({ projectId: 'p1' }, 'a', {
      session: 'triage',
      outcome: 'closed',
      undone: true,
    });
    expect(track).toHaveBeenCalledWith('Plan', 'Used', 'SessionUndone');
    expect(f.state().decided).toBeUndefined();
    expect(f.state().currentId).toBe('a');
  });

  it('Escape cancels the Close dialog, and U undoes a Flag, taking its flag off', () => {
    const f = mount({ mayEdit: true });
    fireEvent.keyDown(window, { key: 'c' });
    expect(screen.getByRole('dialog', { name: 'Close Bug' })).toBeTruthy();
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Reason' }), { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Close Bug' })).toBeNull();
    fireEvent.keyDown(window, { key: 'f' });
    expect(f.plan.patchItem).toHaveBeenCalledWith('a', { set: { flagged: true } });
    expect(f.state().decided?.a).toMatchObject({ outcome: 'flagged', flagSet: true });
    f.items.set('a', card('a', 1, 'new', { priority: 'high', flagged: true }));
    fireEvent.keyDown(window, { key: 'u' });
    expect(f.plan.patchItem).toHaveBeenLastCalledWith('a', { clear: ['flagged'] });
    // A flag never moved the card, so nothing moves back.
    expect(f.plan.moveItem).not.toHaveBeenCalled();
    expect(f.state().decided).toBeUndefined();
  });

  it('never links over another card, and Undo Last on a card since deleted only clears its outcome', () => {
    const f = mount({
      mayEdit: true,
      items: [
        card('a', 1, 'new', { 'f-dup': 'y' }),
        card('b', 2),
        card('y', 8, 'confirmed'),
        card('z', 9, 'confirmed'),
      ],
    });
    fireEvent.keyDown(window, { key: 'c' });
    fireEvent.click(screen.getByRole('button', { name: 'Link Duplicate' }));
    fireEvent.click(
      within(screen.getByRole('dialog', { name: 'Link Duplicate' })).getByRole('button', {
        name: /Card Z/,
      }),
    );
    fireEvent.click(closeBug());
    expect(f.plan.patchItem).not.toHaveBeenCalled();
    expect(f.state().decided?.a).toMatchObject({ duplicateOf: 'z', to: 'duplicate' });
    expect(f.state().decided?.a).not.toHaveProperty('linked');
    f.items.delete('a');
    vi.mocked(f.plan.moveItem).mockClear();
    vi.mocked(recordSessionOutcome).mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Undo Closed BUG-1' }));
    expect(f.plan.moveItem).not.toHaveBeenCalled();
    expect(recordSessionOutcome).not.toHaveBeenCalled();
    expect(f.state().decided).toBeUndefined();
  });

  it('a card moved on since its outcome stays where it is on Undo Outcome', () => {
    const f = mount({
      mayEdit: true,
      session: {
        currentId: 'a',
        decided: { a: { outcome: 'accepted', at: 1, by: 'Sam', from: 'new', to: 'confirmed' } },
      },
      items: [card('a', 1, 'wont-fix'), card('b', 2)],
    });
    fireEvent.click(screen.getByRole('button', { name: 'Undo Outcome' }));
    expect(f.plan.moveItem).not.toHaveBeenCalled();
    expect(f.state().decided).toBeUndefined();
  });

  it('the rows show each card’s priority, and no strip sits above the action bar', () => {
    mount({ mayEdit: true });
    const pills = [...document.querySelectorAll('[data-priority-pill]')].map((p) =>
      p.getAttribute('data-priority-pill'),
    );
    expect(pills).toEqual(['high', 'none', 'none']);
    expect(screen.queryByRole('group', { name: 'Priority' })).toBeNull();
  });

  it('a Participant or a Viewer never decides, nor opens the Close dialog', () => {
    for (const canEditCards of [true, false]) {
      const p = mount({
        mayEdit: false,
        canEditCards,
        session: { facilitator: ALI, currentId: 'a', cardStartedAt: 1 },
      });
      expect(screen.queryByRole('button', { name: /Accept|^Close$|Skip/ })).toBeNull();
      fireEvent.keyDown(window, { key: 'c' });
      fireEvent.keyDown(window, { key: 'u' });
      expect(screen.queryByRole('dialog', { name: 'Close Bug' })).toBeNull();
      expect(p.actions.runSession).not.toHaveBeenCalled();
      cleanup();
    }
  });

  it('closing the last bug can be taken back from Session Complete, by the chip or U', () => {
    const f = mount({ mayEdit: true });
    fireEvent.keyDown(window, { key: 's' });
    fireEvent.keyDown(window, { key: 's' });
    fireEvent.keyDown(window, { key: 'c' });
    const input = screen.getByRole<HTMLInputElement>('textbox', { name: 'Reason' });
    fireEvent.change(input, { target: { value: 'Not a Bug' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getByText('Session Complete')).toBeTruthy();
    expect(f.state().decided?.c).toMatchObject({ from: 'new', to: 'wont-fix', fromRank: 'c' });
    vi.mocked(f.plan.moveItem).mockClear();
    // Undo Last names the last decision there too.
    expect(screen.getByRole('button', { name: 'Undo Closed BUG-3' })).toBeTruthy();
    fireEvent.keyDown(window, { key: 'u' });
    expect(f.plan.moveItem).toHaveBeenCalledWith('c', { status: 'new', before: null });
    expect(f.state().decided?.c).toBeUndefined();
    expect(screen.getByRole('heading', { level: 3, name: 'Card C' })).toBeTruthy();
    // Back on Session Complete, the chip takes the next one back.
    fireEvent.keyDown(window, { key: 's' });
    fireEvent.click(screen.getByRole('button', { name: 'Undo Skipped BUG-3' }));
    expect(screen.getByRole('heading', { level: 3, name: 'Card C' })).toBeTruthy();
  });

  it('Session Complete shows Accepted, Closed, Skipped and Flagged', () => {
    mount({
      mayEdit: true,
      items: [card('a', 1)],
      session: { decided: { a: { outcome: 'closed', at: 1, by: 'Sam', reason: 'Not a Bug' } } },
    });
    expect(screen.getAllByRole('term').map((t) => t.textContent)).toEqual([
      'Accepted',
      'Closed',
      'Skipped',
      'Flagged',
    ]);
  });
});
