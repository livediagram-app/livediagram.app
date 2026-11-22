// @vitest-environment jsdom
// docs/specs/030-knowledgebase/approval.md "Share roles", as the editor draws them: an Editor and a Participant ask
// for approval and decide another's request; the person who asked waits (and may withdraw); a Viewer, a link visitor
// confined to one page, a guest with no account and a knowledgebase kept Offline see the state and nothing to press.
// The api's half is apps/api/src/routes/knowledge-approval-route.test.ts.
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { PageApproval } from '@liveknowledge/knowledge';
import {
  approvalActionsOf,
  approvalCallerOf,
  approvalMarks,
  decidedLine,
  requestedLine,
} from '@/lib/knowledge/approval-view';
import { PageApprovalMeta, showsApprovalMeta } from './PageApprovalMeta';
import { PageHealthApprovalView } from './PageHealthApproval';

const NOW = Date.UTC(2026, 10, 21, 12);
const HOUR = 3_600_000;
const PENDING: PageApproval = {
  state: 'pending',
  requestedBy: 'user_asker',
  requestedAt: NOW - 3 * HOUR,
};
const REJECTED: PageApproval = {
  ...PENDING,
  state: 'rejected',
  decidedBy: 'user_editor',
  decidedAt: NOW - HOUR,
  note: 'Name the on-call rota.',
};
const names: Record<string, string> = { user_asker: 'Priya Shah', user_editor: 'Sam Lee' };
const nameOf = (id: string | undefined) => (id ? names[id] : undefined);

type Who = 'editor' | 'participant' | 'viewer' | 'scoped-link' | 'guest' | 'offline' | 'asker';
const callerOf = (who: Who) =>
  approvalCallerOf({
    level: who === 'viewer' ? 'view' : who === 'participant' ? 'participate' : 'edit',
    account: who === 'guest' ? null : who === 'asker' ? 'user_asker' : 'user_editor',
    isStructureReadOnly: who === 'scoped-link',
    offline: who === 'offline',
  });

describe('who may do what with a page’s approval', () => {
  it('lets an Editor and a Participant ask, and decide someone else’s request', () => {
    for (const who of ['editor', 'participant'] as const) {
      expect(approvalActionsOf(undefined, callerOf(who))).toEqual(['request']);
      expect(approvalActionsOf(PENDING, callerOf(who))).toEqual(
        who === 'editor' ? ['approve', 'reject', 'withdraw'] : ['approve', 'reject'],
      );
      expect(approvalActionsOf(REJECTED, callerOf(who))).toEqual(['request']);
    }
  });

  it('never lets the person who asked decide their own request', () => {
    expect(approvalActionsOf(PENDING, callerOf('asker'))).toEqual(['withdraw']);
  });

  it('offers a Viewer, a link confined to a page, a guest and an Offline knowledgebase nothing', () => {
    for (const who of ['viewer', 'scoped-link', 'guest', 'offline'] as const) {
      expect(approvalActionsOf(undefined, callerOf(who))).toEqual([]);
      expect(approvalActionsOf(PENDING, callerOf(who))).toEqual([]);
    }
  });
});

describe('the meta row', () => {
  const draw = (approval: PageApproval | undefined, who: Who, onAct = vi.fn(async () => true)) => {
    const actions = approvalActionsOf(approval, callerOf(who));
    const drawn = render(
      <PageApprovalMeta
        approval={approval}
        actions={actions}
        nameOf={nameOf}
        self={who === 'asker' ? 'user_asker' : 'user_editor'}
        now={NOW}
        onAct={onAct}
      />,
    );
    return Object.assign(onAct, { container: drawn.container });
  };

  it('draws nothing in the meta row nor the rail until asked from the page menu, then asks before requesting', async () => {
    const { container } = draw(undefined, 'participant');
    expect(container.innerHTML).toBe('');
    const onAct = vi.fn(async () => true);
    const view = (asked: boolean) => (
      <PageHealthApprovalView
        asked={asked}
        approval={undefined}
        actions={approvalActionsOf(undefined, callerOf('participant'))}
        nameOf={nameOf}
        self="user_asker"
        now={NOW}
        onAct={onAct}
      />
    );
    const rail = render(view(false));
    expect(rail.container.innerHTML).toBe('');
    rail.rerender(view(true));
    // A first request asks in a centred dialog, never inside the rail (owner 2026-11-22).
    expect(rail.container.querySelector('[data-health-approval]')).toBeNull();
    const panel = screen.getByRole('dialog');
    expect(panel.textContent).toContain('Request Approval?');
    const confirm = [...panel.querySelectorAll('button')].find(
      (b) => b.textContent === 'Request Approval',
    )!;
    fireEvent.click(confirm);
    await waitFor(() => expect(onAct).toHaveBeenCalledWith('request', undefined));
  });

  it('shows the pending pill to a Viewer, with who asked and nothing to press', () => {
    draw(PENDING, 'viewer');
    fireEvent.click(screen.getByRole('button', { name: 'Pending Approval' }));
    const pop = document.querySelector('[data-approval-popover]')!;
    expect(pop.textContent).toContain('Requested by Priya Shah, 3 hours ago');
    expect([...pop.querySelectorAll('button')].map((b) => b.textContent)).toEqual(['Close']);
  });

  it('draws nothing for a Viewer on a page never asked about', () => {
    expect(showsApprovalMeta(undefined, [])).toBe(false);
    const { container } = render(
      <PageApprovalMeta
        approval={undefined}
        actions={[]}
        nameOf={nameOf}
        self={null}
        now={NOW}
        onAct={vi.fn()}
      />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('rejects with a note an Editor writes', async () => {
    const onAct = draw(PENDING, 'editor');
    fireEvent.click(screen.getByRole('button', { name: 'Pending Approval' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reject' }));
    fireEvent.change(screen.getByLabelText('What needs to change? (optional)'), {
      target: { value: '  Name the rota.  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Reject' }));
    await waitFor(() => expect(onAct).toHaveBeenCalledWith('reject', 'Name the rota.'));
  });

  it('approves in one press', async () => {
    const onAct = draw(PENDING, 'participant');
    fireEvent.click(screen.getByRole('button', { name: 'Pending Approval' }));
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    await waitFor(() => expect(onAct).toHaveBeenCalledWith('approve', undefined));
  });

  it('tells the asker they are waiting, and lets them withdraw', async () => {
    const onAct = draw(PENDING, 'asker');
    fireEvent.click(screen.getByRole('button', { name: 'Pending Approval' }));
    expect(document.querySelector('[data-approval-popover]')!.textContent).toContain(
      'Waiting for someone else to approve it.',
    );
    expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Withdraw' }));
    await waitFor(() => expect(onAct).toHaveBeenCalledWith('withdraw', undefined));
  });
});

describe('Page Health’s Approval panel', () => {
  it('shows a rejection, who rejected it and the note, and offers Request Again', () => {
    render(
      <PageHealthApprovalView
        approval={REJECTED}
        actions={approvalActionsOf(REJECTED, callerOf('editor'))}
        nameOf={nameOf}
        self="user_editor"
        now={NOW}
        onAct={vi.fn()}
      />,
    );
    const panel = document.querySelector('[data-health-approval]')!;
    expect(panel.textContent).toContain('Rejected by you, 1 hour ago');
    expect(document.querySelector('[data-approval-note]')!.textContent).toBe(
      'Name the on-call rota.',
    );
    expect(screen.getByRole('button', { name: 'Request Again' })).toBeTruthy();
  });

  it('offers Cancel on the request form alone, never beside a pending page’s actions', () => {
    const onPutAway = vi.fn();
    const { rerender } = render(
      <PageHealthApprovalView
        asked
        onPutAway={onPutAway}
        approval={undefined}
        actions={['request']}
        nameOf={nameOf}
        self="user_editor"
        now={NOW}
        onAct={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onPutAway).toHaveBeenCalledOnce();
    rerender(
      <PageHealthApprovalView
        asked
        onPutAway={onPutAway}
        approval={PENDING}
        actions={approvalActionsOf(PENDING, callerOf('editor'))}
        nameOf={nameOf}
        self="user_editor"
        now={NOW}
        onAct={vi.fn()}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Approve' })).toBeTruthy();
  });

  it('is absent for a Viewer on a page never asked about', () => {
    const { container } = render(
      <PageHealthApprovalView
        approval={undefined}
        actions={[]}
        nameOf={nameOf}
        self={null}
        now={NOW}
        onAct={vi.fn()}
      />,
    );
    expect(container.innerHTML).toBe('');
  });
});

describe('the words and the tree’s marks', () => {
  it('names an agent’s request for its person, and an account the editor cannot name', () => {
    expect(requestedLine({ ...PENDING, requestedByAgent: 'Claude' }, nameOf, null, NOW)).toBe(
      'Requested by Claude for Priya Shah, 3 hours ago',
    );
    expect(requestedLine({ ...PENDING, requestedBy: 'user_x' }, nameOf, null, NOW)).toContain(
      'Requested by Someone',
    );
    // An account the editor cannot name reads by the name kept with the record.
    expect(
      requestedLine(
        { ...PENDING, requestedBy: 'user_x', requestedByName: 'Ada Lovelace' },
        nameOf,
        null,
        NOW,
      ),
    ).toBe('Requested by Ada Lovelace, 3 hours ago');
    expect(decidedLine(PENDING, nameOf, null, NOW)).toBeUndefined();
    expect(
      decidedLine(
        { ...PENDING, state: 'approved', decidedBy: 'user_editor', decidedAt: NOW },
        nameOf,
        null,
        NOW,
      ),
    ).toMatch(/^Approved by Sam Lee/);
  });

  it('marks pending and rejected pages, and no other', () => {
    const marks = approvalMarks([
      { id: 'a', knowledge: { approval: PENDING } },
      { id: 'b', knowledge: { approval: REJECTED } },
      { id: 'c', knowledge: { approval: { ...PENDING, state: 'approved' } } },
      { id: 'd', knowledge: { owner: 'x' } },
      { id: 'e' },
    ]);
    expect([...marks]).toEqual([
      ['a', 'pending'],
      ['b', 'rejected'],
    ]);
  });
});
