// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DAY_MS, type Item, type ItemTypeDef } from '@liveplanner/items';
import type { SessionSetup } from '@liveplanner/project';
import type { PlanContextValue } from '@/components/plan/PlanContext';

const shown = vi.hoisted(() => ({
  state: { state: 'shown', url: 'blob:x' } as { state: string; url?: string },
}));
const prs = vi.hoisted(() => ({ list: [] as unknown[] }));
vi.mock('@/components/plan/use-image-url', () => ({
  useImageUrl: () => shown.state,
  useSeen: () => [{ current: null }, true],
}));
vi.mock('@/components/plan/pull-request-store', () => ({
  useCardPullRequests: () => prs.list,
}));

import { DemoStrip, demoLinks, demoPictures } from './DemoStrip';
import { FeedbackStrip } from './FeedbackStrip';
import { FollowUpDialog } from './FollowUpDialog';
import { ReviewFeedbackMark } from './ReviewFeedbackMark';
import { ReviewSetupParts, dateValue, dayStart, withRange } from './ReviewSetupParts';
import { ReviewSummary } from './ReviewSummary';
import { feedbackThreadOf, feedbackWords } from './review-feedback';
import { reviewedAt } from './review-range';
import { comment, thread } from '@/components/plan/threads/thread-test-kit';

// docs/specs/026-plan/session-tabs.md "Sprint Review": the review's own parts, each on its own.
const PERSON = { id: 'p', name: 'P', color: '#000' };
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
    'attachments',
    'description',
    'f-shot',
    'f-link',
    'f-pr',
    'f-bad',
    'f-ftp',
  ],
  statuses: ['backlog', 'done'],
  custom: [
    { id: 'f-shot', label: 'Mock-up', kind: 'image' },
    { id: 'f-off', label: 'Hidden', kind: 'image' },
    { id: 'f-link', label: 'Prototype', kind: 'link' },
    { id: 'f-pr', label: 'Pull Request', kind: 'link' },
    { id: 'f-bad', label: 'Broken', kind: 'link' },
    { id: 'f-ftp', label: 'Files', kind: 'link' },
  ],
};
const plain: ItemTypeDef = {
  id: 'plain',
  label: 'Plain',
  newTitle: 'New plain',
  glyph: 'task',
  color: '#64748b',
  fields: ['title', 'status'],
  statuses: ['todo'],
};
const card = (id: string, fields: Item['fields'] = {}, type = 'task'): Item => ({
  id,
  type,
  key: 1,
  rank: 'a',
  fields: { title: `Card ${id}`, status: 'done', ...fields },
  rev: 1,
  createdAt: 0,
  updatedAt: 0,
  createdBy: PERSON,
  updatedBy: PERSON,
});
const full = card('a', {
  'f-shot': 'img-1',
  'f-off': 'img-9',
  'f-link': 'https://example.com/proto',
  'f-pr': 'https://github.com/acme/web/pull/3',
  'f-bad': 'not a url',
  'f-ftp': 'ftp://example.com/x',
  attachments: [
    { id: 'img-1', name: 'Dup', type: 'image/png', size: 1 },
    { id: 'img-2', name: 'Screen.png', type: 'image/png', size: 1 },
    { id: 'doc-1', name: 'Notes.pdf', type: 'application/pdf', size: 1 },
  ],
});

afterEach(() => {
  cleanup();
  shown.state = { state: 'shown', url: 'blob:x' };
  prs.list = [];
});

describe('demo pictures and links', () => {
  it('takes Image fields on the type then picture attachments, each once', () => {
    expect(demoPictures(full, task)).toEqual([
      { id: 'img-1', name: 'Mock-up' },
      { id: 'img-2', name: 'Screen.png' },
    ]);
    expect(demoPictures(card('b'), { ...task, custom: undefined })).toEqual([]);
  });

  it('keeps web addresses that are not pull requests', () => {
    expect(demoLinks(full, task)).toEqual([
      { name: 'Prototype', href: 'https://example.com/proto' },
    ]);
    expect(demoLinks(card('b'), { ...task, custom: undefined })).toEqual([]);
  });
});

describe('DemoStrip', () => {
  const strip = (over: Partial<Parameters<typeof DemoStrip>[0]> = {}) =>
    render(
      <DemoStrip
        item={full}
        type={task}
        presenter={null}
        presenterOn
        canPick={false}
        people={[]}
        scope={null}
        onPresenter={vi.fn()}
        {...over}
      />,
    );

  it('reads No one with no presenter, and a pull request with its state', () => {
    prs.list = [
      {
        ref: { owner: 'acme', repo: 'web', number: 3 },
        status: { key: 'acme/web#3', url: 'u', title: 'Dark mode', state: 'merged' },
      },
      { ref: { owner: 'acme', repo: 'web', number: 4 } },
    ];
    strip();
    expect(screen.getByText('No one')).toBeTruthy();
    expect(screen.getByRole('link', { name: /acme\/web#3, Dark mode/ })).toBeTruthy();
    expect(
      screen.getByRole('link', { name: 'acme/web#4 (opens GitHub in a new tab)' }),
    ).toBeTruthy();
  });

  it('shows a missing picture, and a loading one blank', () => {
    shown.state = { state: 'missing' };
    strip({ presenterOn: false });
    expect(screen.queryByText('Presenter')).toBeNull();
    expect(document.querySelector('[data-demo-picture="img-1"]')?.textContent).toBe('Missing');
    cleanup();
    shown.state = { state: 'loading' };
    strip();
    expect(document.querySelector('[data-demo-picture="img-2"]')?.textContent).toBe('');
    expect(document.querySelector('[data-demo-picture="img-2"]')?.getAttribute('href')).toBeNull();
  });

  it('shows designs with only links, and only pictures', () => {
    strip({ item: card('l', { 'f-link': 'https://example.com/p' }) });
    expect(screen.getByRole('link', { name: 'Prototype (opens in a new tab)' })).toBeTruthy();
    cleanup();
    strip({ item: card('p', { 'f-shot': 'img-1' }) });
    expect(screen.queryByRole('link', { name: /Prototype/ })).toBeNull();
    expect(document.querySelector('[data-demo-picture="img-1"] img')).toBeTruthy();
  });

  it('a picked presenter that is no person names no one', () => {
    const onPresenter = vi.fn();
    strip({ canPick: true, people: [PERSON], presenter: PERSON, onPresenter });
    fireEvent.click(screen.getByRole('button', { name: /Presenter/ }));
    fireEvent.click(screen.getByRole('option', { name: 'No one' }));
    expect(onPresenter).toHaveBeenCalledWith(null);
  });
});

describe('FeedbackStrip', () => {
  it('adds from its button, keeps the text when refused, and waits while saving', async () => {
    let finish: (kept: boolean) => void = () => {};
    const onAdd = vi.fn(() => new Promise<boolean>((r) => (finish = r)));
    render(<FeedbackStrip cardRef="WI-1" count={0} canAdd onAdd={onAdd} />);
    const box = screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Feedback on WI-1' });
    const add = screen.getByRole<HTMLButtonElement>('button', { name: /Add/ });
    expect(add.disabled).toBe(true);
    // Shift+Enter is a new line, not a save; empty text never saves.
    fireEvent.keyDown(box, { key: 'Enter' });
    expect(onAdd).not.toHaveBeenCalled();
    fireEvent.change(box, { target: { value: 'Nice' } });
    fireEvent.keyDown(box, { key: 'Enter', shiftKey: true });
    expect(onAdd).not.toHaveBeenCalled();
    fireEvent.click(add);
    expect(onAdd).toHaveBeenCalledWith('Nice');
    // A second press while saving is ignored.
    fireEvent.keyDown(box, { key: 'Enter' });
    expect(onAdd).toHaveBeenCalledTimes(1);
    await act(async () => finish(false));
    expect(box.value).toBe('Nice');
    expect(screen.getByText('None yet')).toBeTruthy();
  });
});

describe('FollowUpDialog', () => {
  const NAMES = new Map([['backlog', 'Backlog']]);
  const open = (over: Partial<Parameters<typeof FollowUpDialog>[0]> = {}) => {
    const props = {
      item: card('a'),
      items: new Map([['a', card('a')]]),
      types: [task, plain],
      statusNames: NAMES,
      initialTitle: 'x'.repeat(300),
      onCancel: vi.fn(),
      onCreate: vi.fn(),
      ...over,
    };
    render(<FollowUpDialog {...props} />);
    return props;
  };

  it('starts from the newest feedback within the cap and names its description link', () => {
    const p = open();
    const title = screen.getByRole<HTMLInputElement>('textbox', { name: 'Title' });
    expect(title.value).toHaveLength(200);
    expect(screen.getByRole('status').textContent).toBe(
      'Added to Backlog, its description naming WI-1',
    );
    // An Enter mid-composition never creates.
    fireEvent.keyDown(title, { key: 'Enter', isComposing: true });
    expect(p.onCreate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(p.onCancel).toHaveBeenCalled();
  });

  it('on a type with no description or plan name, says only where it goes', () => {
    open({ item: card('q', {}, 'plain'), statusNames: new Map() });
    expect(screen.getByRole('status').textContent).toBe('Added to todo');
  });

  it('leaves focus alone on a touch screen', () => {
    const was = window.matchMedia;
    window.matchMedia = (() => ({
      matches: true,
      addEventListener: () => {},
      removeEventListener: () => {},
    })) as unknown as typeof window.matchMedia;
    try {
      const p = open({ initialTitle: '' });
      const title = screen.getByRole('textbox', { name: 'Title' });
      expect(document.activeElement).not.toBe(title);
      // No title, nothing made.
      fireEvent.keyDown(title, { key: 'Enter' });
      expect(p.onCreate).not.toHaveBeenCalled();
    } finally {
      window.matchMedia = was;
    }
  });
});

describe('ReviewSummary', () => {
  it('skips a follow-up no longer on the plan, and says when none were made', () => {
    const onOpen = vi.fn();
    const items = new Map([
      ['a', card('a')],
      ['n', card('n', { title: 'Next' })],
    ]);
    render(
      <ReviewSummary
        feedback={{ comments: 1, cards: 1 }}
        followUps={[{ from: 'a', ids: ['n', 'gone'] }]}
        items={items}
        types={[task]}
        onOpen={onOpen}
      />,
    );
    expect(screen.getByText('1 comment on 1 card')).toBeTruthy();
    expect(screen.getAllByRole('button')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: /Next/ }));
    expect(onOpen).toHaveBeenCalledWith('n');
    cleanup();
    render(
      <ReviewSummary
        feedback={{ comments: 0, cards: 0 }}
        followUps={[]}
        items={items}
        types={[task]}
        onOpen={onOpen}
      />,
    );
    expect(screen.getByText('None made')).toBeTruthy();
    expect(screen.getByText('None yet')).toBeTruthy();
  });
});

describe('review feedback', () => {
  it('replies in the newest open feedback thread, and words the count', () => {
    const old = thread('t1', { comments: [comment('c1', { label: 'review' })], updatedAt: 1 });
    const fresh = thread('t2', { comments: [comment('c2', { label: 'review' })], updatedAt: 2 });
    const closed = thread('t3', {
      comments: [comment('c3', { label: 'review' })],
      updatedAt: 3,
      resolved: true,
    });
    const other = thread('t4', { updatedAt: 4 });
    expect(feedbackThreadOf([old, fresh, closed, other])?.id).toBe('t2');
    expect(feedbackThreadOf([fresh, old])?.id).toBe('t2');
    expect(feedbackThreadOf([other])).toBeNull();
    expect(feedbackWords({ comments: 5, cards: 3 })).toBe('5 comments on 3 cards');
  });

  it('marks a Review Feedback comment', () => {
    render(<ReviewFeedbackMark />);
    expect(screen.getByText('Review Feedback')).toBeTruthy();
  });
});

describe('reviewedAt', () => {
  it('reads the newest decision of another review tab', () => {
    const plan = {
      planTabs: () => [
        {
          id: 'r1',
          kind: 'session',
          session: {
            sessionKind: 'review',
            decided: { a: { outcome: 'reviewed', at: 9, by: 'S' } },
          },
        },
        {
          id: 'r2',
          kind: 'session',
          session: {
            sessionKind: 'review',
            decided: { a: { outcome: 'reviewed', at: 20, by: 'S' } },
          },
        },
        { id: 'b', kind: 'board' },
        { id: 'x', kind: 'session', session: 'junk' },
      ],
    } as unknown as Pick<PlanContextValue, 'planTabs'>;
    expect(reviewedAt(plan)).toBe(20);
    expect(reviewedAt(plan, 'r2')).toBe(9);
    expect(reviewedAt({})).toBeNull();
  });
});

describe('ReviewSetupParts', () => {
  const NOW = 100 * DAY_MS;
  const base: SessionSetup = { typeIds: ['task'], statuses: ['done'], since: NOW - 14 * DAY_MS };
  function mount(setup: SessionSetup, lastReviewAt: number | null) {
    let s = setup;
    const onChange = vi.fn((change: (x: SessionSetup) => SessionSetup) => {
      s = change(s);
    });
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    const r = render(
      <ReviewSetupParts id="d" setup={setup} lastReviewAt={lastReviewAt} onChange={onChange} />,
    );
    vi.useRealTimers();
    return { r, get: () => s };
  }
  const pill = (name: string) =>
    within(screen.getByRole('group', { name: 'Done range' })).getByRole('button', { name });

  it('presses the chip the range starts at and keeps a picked one as a date', () => {
    const m = mount(base, NOW - 3 * DAY_MS);
    expect(pill('Last 14 Days').getAttribute('aria-pressed')).toBe('true');
    expect(pill('All Time').getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(pill('Since Last Review'));
    expect(m.get().since).toBe(NOW - 3 * DAY_MS);
    fireEvent.click(pill('All Time'));
    expect(m.get().since).toBeUndefined();
  });

  it('has no Since Last Review with no earlier review, and All Time pressed with no start', () => {
    mount({ typeIds: ['task'], statuses: ['done'] }, null);
    expect(screen.queryByRole('button', { name: 'Since Last Review' })).toBeNull();
    expect(pill('All Time').getAttribute('aria-pressed')).toBe('true');
    expect(pill('Last 7 Days').getAttribute('aria-pressed')).toBe('false');
  });

  it('takes From and To dates, presses no chip with an end, and drops a cleared date', () => {
    const m = mount({ ...base, until: NOW }, null);
    expect(pill('Last 14 Days').getAttribute('aria-pressed')).toBe('false');
    const [from, to] = screen.getAllByDisplayValue<HTMLInputElement>(/\d{4}-\d{2}-\d{2}/);
    fireEvent.change(to!, { target: { value: '2026-11-20' } });
    expect(m.get().until).toBe(new Date(2026, 10, 21).getTime() - 1);
    fireEvent.change(to!, { target: { value: '' } });
    expect(m.get().until).toBeUndefined();
    fireEvent.change(from!, { target: { value: '2026-11-01' } });
    expect(m.get().since).toBe(new Date(2026, 10, 1).getTime());
  });

  it('switches the presenter off and back to the assignee', () => {
    const m = mount(base, null);
    const group = screen.getByRole('group', { name: 'Presenter' });
    fireEvent.click(within(group).getByRole('button', { name: 'None' }));
    expect(m.get().presenter).toBe('none');
    fireEvent.click(within(group).getByRole('button', { name: 'Assignee' }));
    expect(m.get().presenter).toBeUndefined();
  });

  it('dates read and write in local days, and an end before the start is dropped', () => {
    expect(dateValue(undefined)).toBe('');
    expect(dateValue(new Date(2026, 0, 5).getTime())).toBe('2026-01-05');
    expect(dayStart('nope')).toBeUndefined();
    expect(withRange(base, 10, 5)).not.toHaveProperty('until');
    expect(withRange(base, undefined, 5)).toMatchObject({ until: 5 });
    expect(withRange(base, undefined, undefined)).not.toHaveProperty('since');
  });
});
