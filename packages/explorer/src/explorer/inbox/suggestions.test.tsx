// Suggested edits in the Inbox (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Inbox", "Suggested edits";
// Work Tracker 1362): an agent's edit waiting on the reader's page is a row that counts, with its own filter while
// there is one; its pane quotes the reason and shows the change, and Accept and Dismiss go through the app's own
// suggestion routes (`InboxActions`), saying why when the app refuses.
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { InboxSuggestion } from '@liveworkspace/index-client';
import { createFakeIndex } from '../../test/fakeClient';
import type { InboxData } from '../../data/useInbox';
import { createInboxActions, type InboxApi } from '../../inbox-actions';
import { Explorer, type ExplorerProps } from '../Explorer';
import { entryPlace } from './inbox-entry-place';
import { changeLines } from './SuggestionPane';
import {
  inboxBadge,
  inboxEntries,
  inboxFilterCounts,
  inboxSections,
  inboxTotal,
  settledOf,
  shownFilters,
  withoutSettled,
} from './sections';

const NOW = new Date(2026, 10, 22, 12, 0).getTime();
const MIN = 60_000;

const suggestion = (patch: Partial<InboxSuggestion> = {}): InboxSuggestion => ({
  app: 'liveplanner',
  itemId: 'kb-1',
  itemTitle: 'Handbook',
  itemTeamId: null,
  tabId: 'page-1',
  tabName: 'On Call',
  suggestionId: 'sg-1',
  agent: 'Claude',
  reason: 'The rota moved to Tuesdays.',
  kind: 'replace',
  before: 'On call runs on Mondays.',
  after: 'On call runs on Tuesdays.\nSwap with a teammate in the rota.',
  createdAt: NOW - 20 * MIN,
  ...patch,
});

const data = (suggestions: InboxSuggestion[]): InboxData => ({
  threads: [],
  actions: [],
  forms: [],
  suggestions,
});

// The app's api as the pane's verbs reach it: every call recorded, each answered as `reply` says.
function fakeApi(reply: (path: string) => Response = () => new Response(null, { status: 204 })) {
  const calls: { path: string; method: string }[] = [];
  const api: InboxApi = async (path, init) => {
    calls.push({ path, method: init.method });
    return reply(path);
  };
  return { api, calls };
}

function renderInbox(index: ReturnType<typeof createFakeIndex>, over: Partial<ExplorerProps> = {}) {
  return render(
    <Explorer
      app="liveplanner"
      client={index.client}
      view={{ kind: 'inbox' }}
      onNavigate={vi.fn()}
      itemHref={(i, at) =>
        `/open/${i.id}${at?.suggestionId ? `#suggestion=${at.suggestionId}` : ''}`
      }
      onCreate={vi.fn()}
      viewerId="user_me"
      {...over}
    />,
  );
}

const live = () => document.querySelector('[data-inbox-live]')?.textContent ?? '';

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.useRealTimers();
});

describe('the model', () => {
  it('lists each suggestion under its key, newest first, counted in the badge and the total', () => {
    const d = data([suggestion(), suggestion({ suggestionId: 'sg-2', createdAt: NOW - MIN })]);
    const entries = inboxEntries(inboxSections(d, 'user_me'));
    expect(entries.map((e) => e.key)).toEqual([
      'g:liveplanner:kb-1:page-1:sg-2',
      'g:liveplanner:kb-1:page-1:sg-1',
    ]);
    expect(entries[0]!.kind).toBe('Suggestion');
    expect(inboxBadge(d, 'user_me')).toBe(2);
    expect(inboxTotal(d, 'user_me')).toBe(2);
    expect(inboxBadge(d, 'user_me', 'livediagram')).toBeUndefined();
  });

  it('reads an Inbox from an index without suggestions as none', () => {
    const d: InboxData = { threads: [], actions: [], forms: [] };
    expect(inboxSections(d, 'user_me').suggestions).toEqual([]);
    expect(withoutSettled(d, new Map([['g:x', 1]]))).toEqual(d);
  });

  it('offers Suggested Edits only while there is one, or it is the choice', () => {
    const none = inboxFilterCounts([]);
    expect(shownFilters(none, 'all')).not.toContain('suggestions');
    expect(shownFilters(none, 'suggestions')).toContain('suggestions');
    const one = inboxFilterCounts(inboxEntries(inboxSections(data([suggestion()]), 'user_me')));
    expect(one.suggestions).toBe(1);
    expect(shownFilters(one, 'all')).toContain('suggestions');
  });

  it('keeps a suggestion done here out until a read lists it changed', () => {
    const d = data([suggestion()]);
    const [entry] = inboxEntries(inboxSections(d, 'user_me'));
    const settled = settledOf(entry!);
    expect(settled).toEqual({ key: 'g:liveplanner:kb-1:page-1:sg-1', at: NOW - 20 * MIN });
    const map = new Map([[settled.key, settled.at]]);
    expect(withoutSettled(d, map).suggestions).toEqual([]);
    expect(withoutSettled(data([suggestion({ createdAt: NOW })]), map).suggestions).toHaveLength(1);
  });

  it('opens the page with the suggestion’s popover', () => {
    const [entry] = inboxEntries(inboxSections(data([suggestion()]), 'user_me'));
    expect(entryPlace(entry!)).toEqual({ tabId: 'page-1', suggestionId: 'sg-1' });
  });

  it('splits the change into lines, none for an empty text', () => {
    expect(changeLines('')).toEqual([]);
    expect(changeLines('a\r\nb\nc')).toEqual(['a', 'b', 'c']);
  });
});

describe('the verbs', () => {
  it('accept and dismiss through the app’s suggestion routes', async () => {
    const { api, calls } = fakeApi();
    const actions = createInboxActions({ api: () => api });
    const target = {
      kind: 'Suggestion' as const,
      app: 'liveknowledge' as const,
      itemId: 'kb 1',
      tabId: 'page-1',
      elementId: 'sg/1',
      actionId: null,
      local: false,
    };
    expect(actions.offers(target)).toEqual(['accept', 'dismiss']);
    expect(actions.offers({ ...target, local: true })).toEqual([]);
    expect(createInboxActions({ api: () => null }).offers(target)).toEqual([]);
    await actions.accept!(target);
    await actions.dismiss!(target);
    expect(calls).toEqual([
      { path: '/documents/kb%201/suggestions/sg%2F1/accept', method: 'POST' },
      { path: '/documents/kb%201/suggestions/sg%2F1/dismiss', method: 'POST' },
    ]);
  });
});

describe('a suggestion in the Inbox', () => {
  it('reads the agent, the page and Suggested an edit, and its pane shows the change', async () => {
    const index = createFakeIndex();
    index.inbox.suggestions = [suggestion()];
    renderInbox(index);
    const row = await screen.findByRole('option', { name: /Suggested an edit/ });
    expect(row.getAttribute('data-inbox-row')).toBe('Suggestion');
    expect(within(row).getByText('Claude').className).toContain('font-semibold');
    expect(within(row).getByText('On Call')).toBeTruthy();
    expect(row.querySelector('[data-inbox-reason="suggestion"]')).toBeTruthy();
    const pane = document.querySelector('[data-inbox-reader="Suggestion"]') as HTMLElement;
    expect(within(pane).getByText('Claude suggested an edit')).toBeTruthy();
    expect(await within(pane).findByText('The rota moved to Tuesdays.')).toBeTruthy();
    const removed = pane.querySelectorAll('[data-inbox-suggestion-removed]');
    const added = pane.querySelectorAll('[data-inbox-suggestion-added]');
    expect([...removed].map((l) => l.textContent)).toEqual(['−Removed: On call runs on Mondays.']);
    expect([...added].map((l) => l.textContent)).toEqual([
      '+Added: On call runs on Tuesdays.',
      '+Added: Swap with a teammate in the rota.',
    ]);
    expect(screen.getByRole('option', { name: /Suggested Edits \(1\)/ })).toBeTruthy();
    // Open in the app opens the page at the suggestion.
    expect(
      within(pane)
        .getByText(/Open in/)
        .closest('a')!
        .getAttribute('href'),
    ).toBe('/open/kb-1#suggestion=sg-1');
  });

  it('shows an append as added lines alone', async () => {
    const index = createFakeIndex();
    index.inbox.suggestions = [suggestion({ kind: 'append', before: '', after: '## Escalation' })];
    renderInbox(index);
    await screen.findByRole('option', { name: /Suggested an edit/ });
    expect(document.querySelectorAll('[data-inbox-suggestion-removed]')).toHaveLength(0);
    expect(screen.getByText('Added at the End of the Page')).toBeTruthy();
  });

  it('offers no Accept or Dismiss where this page cannot reach the app', async () => {
    const index = createFakeIndex();
    index.inbox.suggestions = [suggestion()];
    renderInbox(index, { inbox: { actions: createInboxActions({ api: () => null }) } });
    await screen.findByRole('option', { name: /Suggested an edit/ });
    expect(screen.queryByRole('button', { name: /Accept/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Dismiss/ })).toBeNull();
  });

  it.each([
    ['Accept', /Accept/, 'accept', 'Accepted the edit to On Call'],
    ['Dismiss', /Dismiss/, 'dismiss', 'Dismissed the edit'],
  ])('%s in one press, and the row leaves', async (_name, button, verb, words) => {
    const onTelemetry = vi.fn();
    const { api, calls } = fakeApi();
    const index = createFakeIndex();
    index.inbox.suggestions = [suggestion()];
    renderInbox(index, {
      inbox: { onTelemetry, actions: createInboxActions({ api: () => api }) },
    });
    fireEvent.click(await screen.findByRole('button', { name: button }));
    await waitFor(() =>
      expect(screen.queryByRole('option', { name: /Suggested an edit/ })).toBeNull(),
    );
    expect(calls).toEqual([{ path: `/projects/kb-1/suggestions/sg-1/${verb}`, method: 'POST' }]);
    expect(onTelemetry).toHaveBeenCalledWith('Resolved', 'Suggestion');
    expect(live()).toBe(words);
  });

  it('accepts with e from the keyboard', async () => {
    const { api, calls } = fakeApi();
    const index = createFakeIndex();
    index.inbox.suggestions = [suggestion()];
    renderInbox(index, { inbox: { actions: createInboxActions({ api: () => api }) } });
    await screen.findByRole('option', { name: /Suggested an edit/ });
    fireEvent.keyDown(screen.getByRole('listbox'), { key: 'e' });
    await waitFor(() =>
      expect(calls.map((c) => c.path)).toEqual(['/projects/kb-1/suggestions/sg-1/accept']),
    );
  });

  it.each([
    [403, { error: 'forbidden' }, /Accept/, 'Only an Editor can accept or dismiss this.'],
    [
      409,
      { error: 'suggestion_stale' },
      /Accept/,
      'The page has changed since this was suggested. Open the page to make the change by hand, or dismiss it.',
    ],
    [500, {}, /Accept/, 'The edit could not be accepted. Try again.'],
    [500, {}, /Dismiss/, 'The edit could not be dismissed. Try again.'],
  ])('keeps the row on a %s, saying why', async (status, answer, button, words) => {
    const { api } = fakeApi(() => Response.json(answer, { status }));
    const index = createFakeIndex();
    index.inbox.suggestions = [suggestion()];
    renderInbox(index, { inbox: { actions: createInboxActions({ api: () => api }) } });
    fireEvent.click(await screen.findByRole('button', { name: button }));
    expect((await screen.findByRole('alert')).textContent).toBe(words);
    expect(screen.getByRole('option', { name: /Suggested an edit/ })).toBeTruthy();
  });

  it('takes no second press while one is out', async () => {
    let release: () => void = () => {};
    const calls: string[] = [];
    const api: InboxApi = (path) => {
      calls.push(path);
      return new Promise((resolve) => {
        release = () => resolve(new Response(null, { status: 204 }));
      });
    };
    const index = createFakeIndex();
    index.inbox.suggestions = [suggestion()];
    renderInbox(index, { inbox: { actions: createInboxActions({ api: () => api }) } });
    fireEvent.click(await screen.findByRole('button', { name: /Accept/ }));
    await screen.findByText('Accepting…');
    fireEvent.click(screen.getByRole('button', { name: /Accepting/ }));
    fireEvent.click(screen.getByRole('button', { name: /Dismiss/ }));
    expect(calls).toHaveLength(1);
    await act(async () => release());
    await waitFor(() =>
      expect(screen.queryByRole('option', { name: /Suggested an edit/ })).toBeNull(),
    );
  });
});
