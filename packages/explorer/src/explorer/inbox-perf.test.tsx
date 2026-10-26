// The Inbox's performance guards, at 300 rows of every kind (actions, cards, threads, forms): mounting, switching
// the filter, and running the selection down the whole list, each within a budget, with the times logged.

import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { InboxAction, InboxForm, InboxThread } from '@liveworkspace/index-client';
import { createFakeIndex } from '../test/fakeClient';
import { ToastProvider } from '../ui/Toasts';
import { ExplorerProvider } from './context';
import { InboxPane } from './InboxPane';

const N = 300;
// Generous for a slow CI machine: on 26 October 2026, 300 rows mounted in a median of about 240 ms on a laptop and
// 1,050 ms on a CI runner.
const BUDGET_MS = 1500;
// The first mount is cold (nothing JIT-compiled yet) and takes about 1.6 times the median on both machines (400 and
// 1,590 ms), so it gets twice the budget: held to BUDGET_MS, it failed CI while the warm mounts were well inside it.
const FIRST_MOUNT_BUDGET_MS = 2 * BUDGET_MS;

const at = 1_700_000_000_000;
const APPS = ['liveplanner', 'livediagram', 'livedocuments', 'livedesign'] as const;

function rows() {
  const actions: InboxAction[] = [];
  const threads: InboxThread[] = [];
  const forms: InboxForm[] = [];
  for (let i = 0; i < N; i++) {
    const place = {
      app: APPS[i % 4]!,
      itemId: `item-${i}`,
      itemTitle: `Item ${i}`,
      itemTeamId: i % 5 === 0 ? 'team-1' : null,
      tabId: 'tab-1',
      tabName: 'Roadmap',
    };
    if (i % 3 === 0) {
      actions.push({
        ...place,
        elementId: `el-${i}`,
        actionId: `a${i}`,
        elementLabel: 'Kick-off',
        name: `Action ${i}`,
        description: i % 2 ? 'A note' : '',
        status: 'open',
        assigneeId: i % 2 ? 'user_me' : 'user_bo',
        assigneeName: 'Bo',
        assignerId: i % 2 ? 'user_sam' : 'user_me',
        assignerName: 'Sam Lee',
        teamId: null,
        card:
          i % 4 === 0
            ? { key: i, type: 'bug', typeLabel: 'Bug', title: `Card ${i}`, board: null }
            : null,
        createdAt: at,
        updatedAt: at - i,
      });
    } else if (i % 3 === 1) {
      threads.push({
        ...place,
        elementId: `el-${i}`,
        elementLabel: 'Budget',
        resolved: false,
        commentCount: (i % 7) + 1,
        latestText: 'Can we halve it?',
        latestAuthorName: 'Ada King',
        latestAuthorColor: '#f97316',
        card: null,
        mentionsYou: i % 2 === 0,
        youCommented: i % 3 === 0,
        onYourItem: true,
        firstAt: at - 1000,
        latestAt: at - i,
      });
    } else {
      forms.push({
        app: place.app,
        itemId: place.itemId,
        itemTitle: place.itemTitle,
        itemTeamId: null,
        tabId: `f${i}`,
        heading: 'Bug Report',
        boardTabId: null,
        unseen: 2,
        latestAt: at - i,
      });
    }
  }
  return { actions, threads, forms };
}

async function mount() {
  const index = createFakeIndex();
  const r = rows();
  index.inbox.actions.push(...r.actions);
  index.inbox.threads.push(...r.threads);
  index.inbox.forms.push(...r.forms);
  const t0 = performance.now();
  const view = render(
    <ToastProvider>
      <ExplorerProvider
        app="liveplanner"
        client={index.client}
        view={{ kind: 'inbox' }}
        filter="all"
        setFilter={vi.fn()}
        onNavigate={vi.fn()}
        itemHref={(i) => `/open/${i.id}`}
        onCreate={vi.fn()}
        viewerId="user_me"
      >
        <InboxPane />
      </ExplorerProvider>
    </ToastProvider>,
  );
  // The read resolves in a microtask; flush it inside act.
  await act(async () => {});
  const ms = performance.now() - t0;
  const mounted = view.container.querySelectorAll('[data-inbox-row]').length;
  return { ms, mounted, view };
}

describe(`${N} Inbox rows`, () => {
  it('mount within budget', async () => {
    const runs: number[] = [];
    for (let i = 0; i < 5; i++) {
      const { ms, mounted, view } = await mount();
      expect(mounted).toBe(N);
      runs.push(ms);
      view.unmount();
    }
    const sorted = [...runs].sort((a, b) => a - b);
    const median = sorted[2]!;
    console.info(
      `inbox: ${N} rows, first mount ${runs[0]!.toFixed(1)} ms, median of 5 ${median.toFixed(1)} ms`,
    );
    expect(runs[0]).toBeLessThan(FIRST_MOUNT_BUDGET_MS);
    expect(median).toBeLessThan(BUDGET_MS);
  }, 30_000);

  it('switches the filter within budget, every filter and back', async () => {
    const { view } = await mount();
    const filters = [...view.container.querySelectorAll<HTMLElement>('[data-inbox-filter]')];
    const t0 = performance.now();
    for (let round = 0; round < 2; round++)
      for (const f of [...filters.slice(1), filters[0]!]) act(() => fireEvent.click(f));
    const per = (performance.now() - t0) / (2 * filters.length);
    console.info(`inbox: ${N} rows, a filter change ${per.toFixed(1)} ms`);
    expect(view.container.querySelectorAll('[data-inbox-row]')).toHaveLength(N);
    // At most one mount's work (rows leaving and arriving), so it shares the mount's generous budget's half.
    expect(per).toBeLessThan(BUDGET_MS / 2);
    view.unmount();
  }, 30_000);

  it('moves the selection down all the rows within budget, focus staying on the list', async () => {
    const { view } = await mount();
    const list = screen.getByRole('listbox');
    list.focus();
    const t0 = performance.now();
    for (let i = 0; i < N - 1; i++) fireEvent.keyDown(list, { key: 'j' });
    const per = (performance.now() - t0) / (N - 1);
    console.info(`inbox: ${N} rows, one step of the selection ${per.toFixed(2)} ms`);
    const last = view.container.querySelectorAll('[data-inbox-row]')[N - 1]!;
    expect(list.getAttribute('aria-activedescendant')).toBe(last.id);
    expect(document.activeElement).toBe(list);
    // A held j repeats about every 30 ms; one step must keep up. The pane is patched in place, not remounted:
    // remounting it per row cost about 30 ms a step here.
    expect(per).toBeLessThan(30);
    view.unmount();
  }, 30_000);
});
