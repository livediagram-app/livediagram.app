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
import { liveThreads, thread, comment, PLAN } from '@/components/plan/threads/thread-test-kit';
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
vi.mock('@/components/plan/use-image-url', () => ({
  useImageUrl: (_s: unknown, id: string | null) => ({ state: 'shown', url: `blob:${id}` }),
  useSeen: () => [{ current: null }, true],
}));
vi.mock('@/lib/api/item-history', () => ({ recordSessionOutcome: vi.fn(async () => {}) }));
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
vi.mock('./session-chime', () => ({ playSessionChime: vi.fn() }));

import { SessionPage } from './SessionPage';

// docs/specs/026-plan/session-tabs.md "Sprint Review", "Share roles": finished cards in a done range (archived ones
// too, never reopened) walked one at a time; Reviewed keeps the card where it is and records it; feedback is a Review
// Feedback comment on the real card; Follow-up makes a linked card; Session Complete sums both up.
const DAY = 86_400_000;
const NOW = 100 * DAY;
const task: ItemTypeDef = {
  id: 'task',
  label: 'Task',
  newTitle: 'New task',
  glyph: 'task',
  color: '#0ea5e9',
  prefix: 'WI',
  fields: [
    'title',
    'status',
    'assignee',
    'description',
    'attachments',
    'f-pr',
    'f-rel',
    'f-shot',
    'f-doc',
  ],
  statuses: ['backlog', 'doing', 'done'],
  custom: [
    { id: 'f-pr', label: 'Pull Request', kind: 'pullrequest' },
    { id: 'f-rel', label: 'Related', kind: 'card', linkType: 'task', multiple: true },
    { id: 'f-shot', label: 'Mock-up', kind: 'image' },
    { id: 'f-doc', label: 'Prototype', kind: 'link' },
  ],
};
const note: ItemTypeDef = {
  id: 'note',
  label: 'Note',
  newTitle: 'New note',
  glyph: 'task',
  color: '#64748b',
  fields: ['title', 'status', 'description'],
  statuses: ['backlog', 'done'],
};
const JO = { id: 'p-jo', name: 'Jo Park', color: '#0891b2' };
const card = (id: string, key: number, fields: Item['fields'] = {}): Item => ({
  id,
  type: 'task',
  key,
  rank: id,
  fields: { title: `Card ${id.toUpperCase()}`, status: 'done', statusSince: NOW - DAY, ...fields },
  rev: 1,
  createdAt: key,
  updatedAt: key,
  createdBy: JO,
  updatedBy: JO,
});
const SAM: SessionFacilitator = { id: 'k-sam', name: 'Sam', color: '#0ea5e9' };
const TAB = { id: 't1', name: 'Sprint Review', elements: [] } as unknown as Tab;
const SETUP: SessionSetup = {
  typeIds: ['task'],
  statuses: ['done'],
  sortBy: [{ field: 'updatedAt', dir: 'asc' }],
  since: NOW - 14 * DAY,
};
const NAMES = new Map([
  ['backlog', 'Backlog'],
  ['doing', 'Doing'],
  ['done', 'Done'],
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
  canComment?: boolean;
  session?: Partial<SessionTabState>;
  items?: Item[];
  refuse?: boolean;
}) {
  const items = new Map(
    (
      opts.items ?? [
        card('a', 1, {
          assignee: JO,
          'f-pr': 'https://github.com/acme/web/pull/812',
          'f-shot': 'img-1',
          'f-doc': 'https://example.com/proto',
        }),
        // Archived, still read.
        card('b', 2, { archived: true }),
        // Finished before the range: left out.
        card('old', 3, { statusSince: NOW - 40 * DAY }),
        // Trashed: never read.
        card('gone', 4, { status: 'trash' }),
        // Not finished.
        card('wip', 5, { status: 'doing' }),
      ]
    ).map((i) => [i.id, i]),
  );
  const plan = {
    items,
    types: [task, note],
    statusNames: NAMES,
    statusPhases: new Map(),
    people: [JO, { id: 'p-ali', name: 'Ali', color: '#dc2626' }],
    canEditCards: opts.mayEdit,
    moveItem: vi.fn(),
    patchItem: vi.fn(async () => true),
    addItem: vi.fn(
      async (input: { id: string; type: string; status: string; fields: Item['fields'] }) => {
        items.set(input.id, {
          ...card(input.id, 9),
          type: input.type,
          fields: { ...input.fields, status: input.status },
        });
        return true;
      },
    ),
    openItem: vi.fn(),
    announce: vi.fn(),
    itemsScope: { projectId: PLAN },
  } as unknown as PlanContextValue;
  let state: SessionTabState = { ...newSessionTab('review', SETUP), ...opts.session };
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
  return { plan, items, acts: live.acts, state: () => state };
}

const feedbackBox = () => screen.getByRole<HTMLTextAreaElement>('textbox', { name: /Feedback on/ });
const addFeedback = async (text: string) => {
  fireEvent.change(feedbackBox(), { target: { value: text } });
  await act(async () => {
    fireEvent.keyDown(feedbackBox(), { key: 'Enter' });
  });
};

describe('SessionPage: Sprint Review', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
  });
  afterEach(() => vi.useRealTimers());

  it('queues finished cards in the range, archived ones too, and Reviewed moves nothing', () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const f = mount({ mayEdit: true });
    const rows = screen.getAllByRole('option').map((o) => o.textContent);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toContain('Card A');
    expect(rows[1]).toContain('Card B');
    expect(screen.getByText(/Stays in/).textContent).toBe('Stays in Done');
    fireEvent.click(screen.getByRole('button', { name: /Reviewed/ }));
    act(() => {
      vi.runAllTimers();
    });
    expect(f.plan.moveItem).not.toHaveBeenCalled();
    expect(f.plan.patchItem).not.toHaveBeenCalled();
    expect(recordSessionOutcome).toHaveBeenCalledWith({ projectId: PLAN }, 'a', {
      session: 'review',
      outcome: 'reviewed',
    });
    expect(track).toHaveBeenCalledWith('Plan', 'Used', 'SessionReviewed');
    expect(f.state().decided?.a).toMatchObject({ outcome: 'reviewed' });
    expect(f.state().decided?.a?.from).toBeUndefined();
    // The archived card is next, and stays archived when reviewed.
    expect(screen.getByRole('heading', { level: 3, name: 'Card B' })).toBeTruthy();
    fireEvent.keyDown(window, { key: 'r' });
    act(() => {
      vi.runAllTimers();
    });
    expect(f.state().decided?.b?.outcome).toBe('reviewed');
    expect(f.items.get('b')?.fields.archived).toBe(true);
    expect(f.plan.patchItem).not.toHaveBeenCalled();
    expect(screen.getByText('Session Complete')).toBeTruthy();
  });

  it('shows the presenter, pull requests and designs in the demo strip; the facilitator renames the presenter', () => {
    const f = mount({ mayEdit: true });
    const demo = screen.getByRole('region', { name: 'Demo' });
    expect(within(demo).getByText('Jo Park')).toBeTruthy();
    expect(
      within(demo)
        .getByRole('link', { name: /acme\/web#812/ })
        .getAttribute('href'),
    ).toBe('https://github.com/acme/web/pull/812');
    expect(
      within(demo)
        .getByRole('link', { name: /Mock-up/ })
        .getAttribute('href'),
    ).toBe('blob:img-1');
    expect(
      within(demo)
        .getByRole('link', { name: /Prototype/ })
        .getAttribute('href'),
    ).toBe('https://example.com/proto');
    // The row with an assignee shows its presenter disc; the other has none.
    expect(document.querySelectorAll('[data-presenter="p-jo"]').length).toBe(1);
    fireEvent.click(within(demo).getByRole('button', { name: /Presenter/ }));
    fireEvent.click(screen.getByRole('option', { name: /Ali/ }));
    expect(f.state().presenters?.a).toMatchObject({ id: 'p-ali', name: 'Ali' });
    // The archived card has nothing linked to demo.
    fireEvent.click(screen.getAllByRole('option')[1]!);
    expect(
      within(screen.getByRole('region', { name: 'Demo' })).getByText('Nothing linked to demo'),
    ).toBeTruthy();
  });

  it('keeps feedback as Review Feedback comments, one thread per card', async () => {
    const f = mount({ mayEdit: true });
    await addFeedback('Tooltips are still white');
    expect(f.acts[0]).toEqual({
      kind: 'start',
      itemId: 'a',
      text: 'Tooltips are still white',
      title: 'Sprint Review feedback',
      label: 'review',
    });
    expect(feedbackBox().value).toBe('');
    expect(screen.getByText('1 so far')).toBeTruthy();
    await addFeedback('Follow the OS setting?');
    expect(f.acts[1]).toMatchObject({ kind: 'reply', threadId: 'th-new', label: 'review' });
    expect(screen.getByText('2 so far')).toBeTruthy();
  });

  it('Session Settings offers the Done Range and Presenter', () => {
    mount({ mayEdit: true });
    fireEvent.click(screen.getByRole('button', { name: 'Session Settings' }));
    expect(screen.getByRole('group', { name: 'Done range' })).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Presenter' })).toBeTruthy();
  });

  it('keeps the typed feedback when the write is refused', async () => {
    mount({ mayEdit: true, refuse: true });
    await addFeedback('Lost?');
    expect(feedbackBox().value).toBe('Lost?');
    expect(screen.getByText('None yet')).toBeTruthy();
  });

  it('Follow-up makes a linked card from the newest feedback, through Related', async () => {
    const f = mount({ mayEdit: true });
    await addFeedback('Dark tooltips');
    fireEvent.keyDown(window, { key: 'n' });
    const dialog = screen.getByRole('dialog', { name: 'New Follow-up' });
    expect(within(dialog).getByText(/Added to/).textContent).toBe(
      'Added to Backlog, linked to WI-1 through Related',
    );
    const title = within(dialog).getByRole<HTMLInputElement>('textbox', { name: 'Title' });
    expect(title.value).toBe('Dark tooltips');
    // Keys never decide while the dialog is open.
    fireEvent.keyDown(window, { key: 's' });
    expect(f.state().decided).toBeUndefined();
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Create Follow-up' }));
    });
    expect(f.plan.addItem).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'task',
        status: 'backlog',
        after: null,
        fields: { title: 'Dark tooltips', 'f-rel': ['a'] },
      }),
    );
    const id = vi.mocked(f.plan.addItem).mock.calls[0]![0].id!;
    expect(f.state().followUps?.a).toEqual([id]);
    expect(track).toHaveBeenCalledWith('Plan', 'Used', 'SessionFollowUp');
    // The room stays on the reviewed card.
    expect(screen.getByRole('heading', { level: 3, name: 'Card A' })).toBeTruthy();
  });

  it('opening and closing Follow-up keeps one feedback strip', () => {
    mount({ mayEdit: true });
    for (let i = 0; i < 3; i++) {
      fireEvent.keyDown(window, { key: 'n' });
      const dialog = screen.getByRole('dialog', { name: 'New Follow-up' });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    }
    expect(document.querySelectorAll('[data-feedback-strip]')).toHaveLength(1);
  });

  it('a type with no follow-up field names the card in its description', async () => {
    const f = mount({ mayEdit: true });
    fireEvent.click(screen.getByRole('button', { name: /Follow-up/ }));
    const dialog = screen.getByRole('dialog', { name: 'New Follow-up' });
    const create = within(dialog).getByRole<HTMLButtonElement>('button', {
      name: 'Create Follow-up',
    });
    expect(create.disabled).toBe(true);
    fireEvent.change(within(dialog).getByRole('combobox', { name: 'Card Type' }), {
      target: { value: 'note' },
    });
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Title' }), {
      target: { value: 'Write it up' },
    });
    await act(async () => {
      fireEvent.click(create);
    });
    expect(f.plan.addItem).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'note',
        fields: { title: 'Write it up', description: 'Follow-up from WI-1: Card A' },
      }),
    );
  });

  it('a refused follow-up is not kept on the tab', async () => {
    const f = mount({ mayEdit: true });
    vi.mocked(f.plan.addItem).mockResolvedValueOnce(false);
    fireEvent.keyDown(window, { key: 'n' });
    fireEvent.change(screen.getByRole('textbox', { name: 'Title' }), { target: { value: 'X' } });
    await act(async () => {
      fireEvent.keyDown(screen.getByRole('textbox', { name: 'Title' }), { key: 'Enter' });
    });
    expect(f.state().followUps).toBeUndefined();
    expect(track).not.toHaveBeenCalledWith('Plan', 'Used', 'SessionFollowUp');
  });

  it('Session Complete sums up the feedback and lists the follow-ups made', () => {
    const fb = thread('th-1', {
      comments: [comment('c1', { label: 'review' }), comment('c2', { label: 'review' })],
      cards: [{ projectId: PLAN, itemId: 'a', key: 1 }],
    });
    // Threads holding two Review Feedback comments on card A.
    const plan = mountWith([fb]);
    expect(document.querySelector('[data-review-feedback]')?.textContent).toBe(
      '2 comments on 1 card',
    );
    const row = document.querySelector<HTMLButtonElement>('[data-review-follow-up="n1"]')!;
    expect(row.textContent).toContain('Dark tooltips');
    expect(row.textContent).toContain('from WI-1');
    fireEvent.click(row);
    expect(plan.openItem).toHaveBeenCalledWith('n1');
    cleanup();
    // A follow-up still in the queue opens in the room.
    const again = mountWith([], { a: ['a'] });
    fireEvent.click(document.querySelector<HTMLButtonElement>('[data-review-follow-up="a"]')!);
    expect(again.openItem).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { level: 3, name: 'Card A' })).toBeTruthy();
  });
});

// Session Complete over given threads (mount's threads start empty).
function mountWith(
  threads: ReturnType<typeof thread>[],
  followUps: Record<string, string[]> = { a: ['n1'] },
) {
  const items = new Map([
    ['a', card('a', 1)],
    ['n1', card('n1', 7, { title: 'Dark tooltips', status: 'backlog' })],
  ]);
  const plan = {
    items,
    types: [task, note],
    statusNames: NAMES,
    statusPhases: new Map(),
    people: [],
    canEditCards: true,
    announce: vi.fn(),
    openItem: vi.fn(),
    itemsScope: { projectId: PLAN },
  } as unknown as PlanContextValue;
  const state: SessionTabState = {
    ...newSessionTab('review', SETUP),
    decided: { a: { outcome: 'reviewed', at: 1, by: 'Sam' } },
    followUps,
  };
  const live = liveThreads(threads, { canComment: true, projectId: PLAN });
  render(
    <live.Live>
      <SessionPage
        tab={TAB}
        session={state}
        plan={plan}
        mayEdit
        actions={{ startSession: vi.fn(), changeSetup: vi.fn(), runSession: vi.fn() }}
        self={SAM}
        presence={[]}
      />
    </live.Live>,
  );
  return plan;
}

describe('SessionPage: Sprint Review by role', () => {
  it('a Participant leaves feedback but runs nothing', async () => {
    const f = mount({ mayEdit: false, canComment: true });
    expect(screen.queryByRole('button', { name: /Reviewed/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Follow-up/ })).toBeNull();
    expect(screen.getByText(/running this session/)).toBeTruthy();
    // The presenter reads, with no picker.
    expect(within(screen.getByRole('region', { name: 'Demo' })).queryByRole('button')).toBeNull();
    await addFeedback('Nice');
    expect(f.acts[0]).toMatchObject({ kind: 'start', label: 'review' });
    fireEvent.keyDown(window, { key: 'n' });
    expect(screen.queryByRole('dialog', { name: 'New Follow-up' })).toBeNull();
  });

  it('a Viewer reads the count, with no box', () => {
    mount({ mayEdit: false, canComment: false });
    expect(screen.queryByRole('textbox', { name: /Feedback on/ })).toBeNull();
    expect(document.querySelector('[data-feedback-strip]')?.textContent).toContain(
      'Feedback: none yet',
    );
  });
});
