// The Inbox's performance guard: 300 rows of every kind (actions, cards, threads, forms) mount within a budget.

import { act, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { InboxAction, InboxForm, InboxThread } from '@liveworkspace/index-client';
import { createFakeIndex } from '../test/fakeClient';
import { ToastProvider } from '../ui/Toasts';
import { ExplorerProvider } from './context';
import { InboxPane } from './InboxPane';

const N = 300;
// Generous for a slow CI machine; locally 300 rows mount in a few tens of milliseconds.
const BUDGET_MS = 1500;

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
  view.unmount();
  return { ms, mounted };
}

describe(`${N} Inbox rows`, () => {
  it('mount within budget', async () => {
    const runs: number[] = [];
    for (let i = 0; i < 5; i++) {
      const { ms, mounted } = await mount();
      expect(mounted).toBe(N);
      runs.push(ms);
    }
    const sorted = [...runs].sort((a, b) => a - b);
    const median = sorted[2]!;
    console.info(
      `inbox: ${N} rows, first mount ${runs[0]!.toFixed(1)} ms, median of 5 ${median.toFixed(1)} ms`,
    );
    expect(runs[0]).toBeLessThan(BUDGET_MS);
    expect(median).toBeLessThan(BUDGET_MS);
  });
});
