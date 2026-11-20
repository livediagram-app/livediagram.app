// @vitest-environment jsdom
// The editor's approvals kit (approvals.md "In the editor"): the provider's reads, the badge, the approver's banner
// (a Viewer's one write), and the Share dialog's Approval tab for an Editor.
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  IndexError,
  type Approval,
  type ApprovalCandidate,
  type IndexClient,
} from '@liveworkspace/index-client';
import type { ReactNode } from 'react';
import { ShareDialog } from '../dialogs/ShareDialog';
import { ApprovalBadge } from './ApprovalBadge';
import { ApprovalBanner } from './ApprovalBanner';
import { ApprovalBannerSlot } from './BannerSlot';
import { ApprovalPanel } from './ApprovalPanel';
import { requestErrorWords } from './ApprovalForm';
import {
  APPROVAL_REFRESH_MS,
  ApprovalDoorProvider,
  useApprovalDoor,
  useEditorApprovalDoor,
  type ApprovalClient,
  type ApprovalDoor,
} from './door';

const NOW = Date.now();

function approvalOf(over: Partial<Approval> = {}): Approval {
  return {
    id: 'ap_1',
    itemId: 'i1',
    state: 'open',
    status: 'awaiting',
    requestedBy: { id: 'user_a', name: 'Ada' },
    note: 'Check the dates',
    due: '2020-01-01',
    snapshotId: null,
    createdAt: NOW - 1000,
    closedAt: null,
    approved: 0,
    approvers: [
      { id: 'user_b', name: 'Bo', decision: 'pending', note: null, decidedAt: null },
      { id: 'user_c', name: 'Cy', decision: 'pending', note: null, decidedAt: null },
    ],
    ...over,
  };
}

function fakeClient(
  start: Approval | null,
  opts: {
    people?: ApprovalCandidate[];
    fail?: Partial<Record<keyof ApprovalClient, unknown>>;
  } = {},
) {
  let current = start;
  const fail = opts.fail ?? {};
  const maybeFail = (k: keyof ApprovalClient) => {
    if (fail[k]) throw fail[k];
  };
  const client = {
    getApproval: vi.fn(async () => {
      maybeFail('getApproval');
      return { approval: current };
    }),
    requestApproval: vi.fn(async (_id: string, input: { approverIds: string[] }) => {
      maybeFail('requestApproval');
      current = approvalOf({
        approvers: input.approverIds.map((id) => ({
          id,
          name: id,
          decision: 'pending' as const,
          note: null,
          decidedAt: null,
        })),
      });
      return { approval: current };
    }),
    decideApproval: vi.fn(
      async (_id: string, input: { decision: string; note?: string | null }) => {
        maybeFail('decideApproval');
        current = approvalOf({
          approved: input.decision === 'approve' ? 1 : 0,
          status: input.decision === 'approve' ? 'awaiting' : 'changes_requested',
          approvers: [
            {
              id: 'user_b',
              name: 'Bo',
              decision: input.decision === 'approve' ? 'approved' : 'changes_requested',
              note: input.note ?? null,
              decidedAt: NOW,
            },
            { id: 'user_c', name: 'Cy', decision: 'pending', note: null, decidedAt: null },
          ],
        });
        return { approval: current };
      },
    ),
    cancelApproval: vi.fn(async () => {
      maybeFail('cancelApproval');
      current = null;
    }),
    approvalPeople: vi.fn(async () => {
      maybeFail('approvalPeople');
      return { people: opts.people ?? [] };
    }),
  };
  return client;
}

function doorOf(client: ApprovalClient, over: Partial<ApprovalDoor> = {}): ApprovalDoor {
  return {
    client,
    itemId: 'i1',
    share: null,
    viewerId: 'user_b',
    canRequest: false,
    noun: 'document',
    ...over,
  };
}

function wrap(door: ApprovalDoor | null, children: ReactNode) {
  return render(<ApprovalDoorProvider door={door}>{children}</ApprovalDoorProvider>);
}

afterEach(() => vi.useRealTimers());

describe('the provider', () => {
  it('reads nothing without a door', () => {
    const { container } = wrap(null, <ApprovalBadge />);
    expect(container.textContent).toBe('');
  });

  it('reads once, again on coming back into view after 30 seconds, never sooner', async () => {
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    const client = fakeClient(approvalOf());
    wrap(doorOf(client), <ApprovalBadge />);
    await screen.findByText('Awaiting 0 of 2');
    expect(client.getApproval).toHaveBeenCalledTimes(1);
    const spy = vi.spyOn(Date, 'now');
    spy.mockReturnValue(NOW + 1000);
    act(() => void document.dispatchEvent(new Event('visibilitychange')));
    expect(client.getApproval).toHaveBeenCalledTimes(1);
    spy.mockReturnValue(NOW + APPROVAL_REFRESH_MS * 3);
    act(() => void document.dispatchEvent(new Event('visibilitychange')));
    expect(client.getApproval).toHaveBeenCalledTimes(2);
    spy.mockRestore();
    await waitFor(() => expect(screen.getByText('Awaiting 0 of 2')).toBeTruthy());
  });

  it('builds the editor’s door only for an account on a stored item', async () => {
    const client = fakeClient(null);
    const take = vi.fn(async () => ({ id: 'snap_1' }));
    const setShareOpen = vi.fn();
    const teamMembers = vi.fn(async () => [
      { userId: 'user_t', name: 'Tam', status: 'joined' },
      { userId: null, name: 'Inv', status: 'invited' },
      { userId: 'user_p', name: 'Pen', status: 'invited' },
    ]);
    const base = {
      hydrated: true,
      isOffline: false,
      embedMode: false,
      workbench: null as unknown,
      accountId: 'user_a' as string | null,
      itemId: 'i1' as string | null,
      teamId: 'team_1' as string | null,
      level: 'edit',
      isStructureReadOnly: false,
      shareCode: 'abc' as string | null,
      client,
      noun: 'design',
      teamMembers,
      snapshots: { take } as { take: typeof take } | null,
      setShareOpen,
    };
    const open = renderHook(() => useEditorApprovalDoor(base)).result.current!;
    expect(open).toMatchObject({ viewerId: 'user_a', canRequest: true, share: { code: 'abc' } });
    expect(await open.loadTeamPeople!()).toEqual([{ id: 'user_t', name: 'Tam' }]);
    expect(teamMembers).toHaveBeenCalledWith('user_a', 'team_1');
    expect(await open.takeSnapshot!()).toBe('snap_1');
    expect(take).toHaveBeenCalledWith('Sent for approval');
    open.openShare!();
    expect(setShareOpen).toHaveBeenCalledWith(true);
    for (const over of [
      { hydrated: false },
      { isOffline: true },
      { embedMode: true },
      { workbench: {} },
      { accountId: null },
      { itemId: null },
    ]) {
      expect(renderHook(() => useEditorApprovalDoor({ ...base, ...over })).result.current).toBe(
        null,
      );
    }
    const plain = renderHook(() =>
      useEditorApprovalDoor({ ...base, shareCode: null, teamId: null, snapshots: null }),
    ).result.current!;
    expect(plain.share).toBeNull();
    expect(plain.loadTeamPeople).toBeNull();
    expect(plain.takeSnapshot).toBeNull();
    // A door whose inputs changed under it reads them at call time.
    const hook = renderHook((props: typeof base) => useEditorApprovalDoor(props), {
      initialProps: base,
    });
    const door = hook.result.current!;
    hook.rerender({ ...base, teamId: null, snapshots: null });
    expect(await door.loadTeamPeople!()).toEqual([]);
    await expect(door.takeSnapshot!()).rejects.toThrow('no snapshots');
  });
});

describe('the badge', () => {
  it('draws each status, and nothing for none', async () => {
    for (const [status, label] of [
      ['changes_requested', 'Changes Requested'],
      ['approved', 'Approved'],
      ['changed', 'Changed Since Approval'],
    ] as const) {
      const { unmount } = wrap(doorOf(fakeClient(approvalOf({ status }))), <ApprovalBadge />);
      await screen.findByText(label);
      unmount();
    }
    const { container } = wrap(doorOf(fakeClient(null)), <ApprovalBadge />);
    await waitFor(() => expect(container.textContent).toBe(''));
  });

  it('opens the Share dialog on its Approval tab for an Editor', async () => {
    const openShare = vi.fn();
    let started: boolean | null = null;
    function Probe() {
      const ctx = useApprovalDoor();
      return (
        <button type="button" onClick={() => (started = ctx!.takeStartTab())}>
          probe
        </button>
      );
    }
    wrap(
      doorOf(fakeClient(approvalOf()), { canRequest: true, openShare }),
      <>
        <ApprovalBadge />
        <Probe />
      </>,
    );
    fireEvent.click(await screen.findByRole('button', { name: /Awaiting 0 of 2/ }));
    expect(openShare).toHaveBeenCalled();
    fireEvent.click(screen.getByText('probe'));
    expect(started).toBe(true);
    fireEvent.click(screen.getByText('probe'));
    expect(started).toBe(false);
  });

  it('takes the corner card’s shape, its words hidden on a phone, a button only for an Editor', async () => {
    const { unmount } = wrap(
      doorOf(fakeClient(approvalOf()), { canRequest: true, openShare: vi.fn() }),
      <ApprovalBadge corner />,
    );
    const button = await screen.findByRole('button', { name: /Awaiting 0 of 2/ });
    expect(button.className).toContain('h-9');
    expect(button.className).not.toContain('touch-target-y');
    expect(screen.getByText('Awaiting 0 of 2').className).toContain('phone:sr-only');
    unmount();
    wrap(doorOf(fakeClient(approvalOf({ status: 'approved' }))), <ApprovalBadge corner />);
    const words = await screen.findByText('Approved');
    expect(screen.queryByRole('button')).toBeNull();
    expect(words.parentElement?.className).toContain('h-9');
    expect(words.parentElement?.getAttribute('tabindex')).toBe('0');
  });
});

describe('the banner (a Viewer’s one write)', () => {
  it('asks a named approver, and approves', async () => {
    const client = fakeClient(approvalOf());
    wrap(doorOf(client), <ApprovalBanner />);
    await screen.findByText(/asked you to approve this/);
    expect(screen.getByText('Overdue')).toBeTruthy();
    expect(screen.getByText('Check the dates')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    await screen.findByText('You approved this. Waiting on 1 more.');
    expect(client.decideApproval).toHaveBeenCalledWith('i1', { decision: 'approve' }, null);
    // Change Decision brings the buttons back; Keep My Answer goes back.
    fireEvent.click(screen.getByRole('button', { name: 'Change Decision' }));
    fireEvent.click(screen.getByRole('button', { name: 'Keep My Answer' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByText(/You approved this/)).toBeNull();
  });

  it('asks for changes with a note, Send off until there is one', async () => {
    const client = fakeClient(approvalOf({ due: null, note: null }));
    wrap(doorOf(client), <ApprovalBanner />);
    fireEvent.click(await screen.findByRole('button', { name: 'Request Changes' }));
    const send = screen.getByRole('button', { name: 'Send' }) as HTMLButtonElement;
    expect(send.disabled).toBe(true);
    const field = screen.getByPlaceholderText('What needs to change?');
    fireEvent.keyDown(field, { key: 'Escape' });
    expect(screen.queryByRole('button', { name: 'Send' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Request Changes' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Request Changes' }));
    fireEvent.change(screen.getByPlaceholderText('What needs to change?'), {
      target: { value: ' Fix Q3 ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await screen.findByText('You asked for changes.');
    expect(client.decideApproval).toHaveBeenCalledWith(
      'i1',
      { decision: 'request_changes', note: 'Fix Q3' },
      null,
    );
  });

  it('says when an answer fails, and reads again', async () => {
    const client = fakeClient(approvalOf(), { fail: { decideApproval: new Error('x') } });
    wrap(doorOf(client), <ApprovalBanner />);
    fireEvent.click(await screen.findByRole('button', { name: 'Approve' }));
    await screen.findByRole('alert');
    expect(client.getApproval).toHaveBeenCalledTimes(2);
  });

  it('shows nobody else a banner, nor a closed request', async () => {
    for (const [door, approval] of [
      [{ viewerId: 'user_z' }, approvalOf()],
      [{}, approvalOf({ state: 'approved', status: 'approved' })],
    ] as const) {
      const client = fakeClient(approval);
      const { container, unmount } = wrap(doorOf(client, door), <ApprovalBanner />);
      await waitFor(() => expect(client.getApproval).toHaveBeenCalled());
      expect(container.textContent).toBe('');
      unmount();
    }
  });
});

describe('the banner’s slot', () => {
  it('loads the banner for someone named, and nothing for anyone else', async () => {
    const { unmount } = wrap(doorOf(fakeClient(approvalOf())), <ApprovalBannerSlot />);
    await screen.findByRole('button', { name: 'Approve' });
    unmount();
    const client = fakeClient(approvalOf());
    const { container } = wrap(doorOf(client, { viewerId: 'user_z' }), <ApprovalBannerSlot />);
    await waitFor(() => expect(client.getApproval).toHaveBeenCalled());
    expect(container.textContent).toBe('');
  });
});

describe('the Approval tab', () => {
  const people: ApprovalCandidate[] = [
    { id: 'user_o', name: 'Olu', via: 'owner' },
    { id: 'user_l', name: 'Lin', via: 'link' },
  ];

  it('asks the people ticked, with a note, a due day and a snapshot', async () => {
    const client = fakeClient(null, { people });
    const takeSnapshot = vi.fn(async () => 'snap_9');
    wrap(
      doorOf(client, {
        viewerId: 'user_a',
        canRequest: true,
        takeSnapshot,
        loadTeamPeople: async () => [{ id: 'user_t', name: 'Tam' }],
      }),
      <ApprovalPanel />,
    );
    await screen.findByText('Tam');
    expect(screen.getByText('Team')).toBeTruthy();
    expect(screen.getByText('Owner')).toBeTruthy();
    const ask = screen.getByRole('button', { name: 'Request Approval' }) as HTMLButtonElement;
    expect(ask.disabled).toBe(true);
    fireEvent.click(screen.getByRole('checkbox', { name: /Tam/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Lin/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Lin/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Olu/ }));
    fireEvent.change(screen.getByPlaceholderText('What should they look at?'), {
      target: { value: ' The dates ' },
    });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Save this version as a snapshot' }));
    fireEvent.click(ask);
    await screen.findByRole('button', { name: 'New Request' });
    expect(takeSnapshot).toHaveBeenCalled();
    expect(client.requestApproval).toHaveBeenCalledWith(
      'i1',
      { approverIds: ['user_t', 'user_o'], note: 'The dates', due: null, snapshotId: 'snap_9' },
      null,
    );
  });

  it('links to the Request Approval article under the form and under a request, when the host has one', async () => {
    const { unmount } = wrap(
      doorOf(fakeClient(null), { canRequest: true }),
      <ApprovalPanel helpHref="/help/collaboration/sharing/request-approval/" />,
    );
    await screen.findByText(/Nobody else can open this document yet/);
    const link = screen.getByRole('link', { name: /Learn More/ });
    expect(link.getAttribute('href')).toBe('/help/collaboration/sharing/request-approval/');
    unmount();
    wrap(
      doorOf(fakeClient(approvalOf()), { canRequest: true }),
      <ApprovalPanel helpHref="/help/collaboration/sharing/request-approval/" />,
    );
    await screen.findByRole('button', { name: 'New Request' });
    expect(screen.getByRole('link', { name: /Learn More/ })).toBeTruthy();
  });

  it('shows no help link where the host has no article', async () => {
    wrap(doorOf(fakeClient(null), { canRequest: true }), <ApprovalPanel />);
    await screen.findByText(/Nobody else can open this document yet/);
    expect(screen.queryByRole('link', { name: /Learn More/ })).toBeNull();
  });

  it('says so when nobody else can open it, and when the list fails', async () => {
    const { unmount } = wrap(doorOf(fakeClient(null), { canRequest: true }), <ApprovalPanel />);
    await screen.findByText(/Nobody else can open this document yet/);
    unmount();
    const failing = fakeClient(null, { fail: { approvalPeople: new Error('x') } });
    wrap(doorOf(failing, { canRequest: true }), <ApprovalPanel />);
    await screen.findByText('Couldn’t load who can open it.');
    fireEvent.click(screen.getByRole('button', { name: 'Try Again' }));
    await waitFor(() => expect(failing.approvalPeople).toHaveBeenCalledTimes(2));
  });

  it('filters a long list and caps the ticks at ten', async () => {
    const many = Array.from({ length: 12 }, (_, i) => ({
      id: `user_${i}`,
      name: `Person ${i}`,
      via: 'link' as const,
    }));
    wrap(doorOf(fakeClient(null, { people: many }), { canRequest: true }), <ApprovalPanel />);
    const filter = await screen.findByPlaceholderText('Filter people');
    for (let i = 0; i < 10; i++) {
      fireEvent.click(screen.getByRole('checkbox', { name: new RegExp(`Person ${i}(?!\\d)`) }));
    }
    expect((screen.getByRole('checkbox', { name: /Person 11/ }) as HTMLInputElement).disabled).toBe(
      true,
    );
    expect(screen.getByText('10 picked (at most 10)')).toBeTruthy();
    fireEvent.change(filter, { target: { value: 'nobody' } });
    expect(screen.getByText('Nobody matches “nobody”.')).toBeTruthy();
  });

  it('says a refusal, and a snapshot that could not be saved', async () => {
    const client = fakeClient(null, {
      people,
      fail: { requestApproval: new IndexError(422, 'approver_cannot_open') },
    });
    const takeSnapshot = vi.fn(async () => {
      throw new Error('x');
    });
    wrap(doorOf(client, { canRequest: true, takeSnapshot }), <ApprovalPanel />);
    fireEvent.click(await screen.findByRole('checkbox', { name: /Olu/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Save this version as a snapshot' }));
    fireEvent.click(screen.getByRole('button', { name: 'Request Approval' }));
    await screen.findByText(/Couldn’t save the snapshot/);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Save this version as a snapshot' }));
    fireEvent.click(screen.getByRole('button', { name: 'Request Approval' }));
    await screen.findByText('Someone you picked can no longer open this document.');
  });

  it('words every refusal', () => {
    const words = (code: string) => requestErrorWords(new IndexError(400, code), 'design');
    expect(words('rate_limited')).toMatch(/Try again tomorrow/);
    expect(words('approvals_unavailable')).toMatch(/Couldn’t check/);
    expect(words('forbidden')).toMatch(/Only an Editor/);
    expect(requestErrorWords(new Error('x'), 'design')).toBe(
      'Couldn’t ask for approval. Try again.',
    );
  });

  it('shows where a request stands, cancels it in place, and asks again', async () => {
    const client = fakeClient(
      approvalOf({
        snapshotId: 'snap_1',
        approvers: [
          { id: 'user_b', name: 'Bo', decision: 'changes_requested', note: 'Q3?', decidedAt: NOW },
          { id: 'user_a', name: 'Ada', decision: 'approved', note: null, decidedAt: NOW },
        ],
        status: 'changes_requested',
      }),
      { people },
    );
    wrap(doorOf(client, { viewerId: 'user_a', canRequest: true }), <ApprovalPanel />);
    await screen.findByText('Snapshot saved');
    expect(screen.getAllByText('Changes Requested').length).toBeGreaterThan(1);
    expect(screen.getByText('Q3?')).toBeTruthy();
    expect(screen.getAllByText('You').length).toBe(2);
    fireEvent.click(screen.getByRole('button', { name: 'New Request' }));
    await screen.findByText(/A new request replaces the open one/);
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel Request' }));
    fireEvent.click(screen.getByRole('button', { name: 'Keep It' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel Request' }));
    const confirm = screen.getAllByRole('button', { name: 'Cancel Request' });
    fireEvent.click(confirm[confirm.length - 1]!);
    await screen.findByRole('button', { name: 'Request Approval' });
    expect(client.cancelApproval).toHaveBeenCalledWith('i1', null);
  });

  it('says a failed cancel, a failed read, and loads with placeholders', async () => {
    const client = fakeClient(approvalOf({ requestedBy: { id: 'user_q', name: null } }), {
      fail: { cancelApproval: new Error('x') },
    });
    wrap(doorOf(client, { viewerId: 'user_a', canRequest: true }), <ApprovalPanel />);
    expect(screen.getByLabelText('Loading')).toBeTruthy();
    await screen.findByText('A teammate');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel Request' }));
    const confirm = screen.getAllByRole('button', { name: 'Cancel Request' });
    fireEvent.click(confirm[confirm.length - 1]!);
    await screen.findByText('Couldn’t cancel the request. Try again.');

    const broken = fakeClient(null, { fail: { getApproval: new Error('x') } });
    wrap(doorOf(broken, { canRequest: true }), <ApprovalPanel />);
    await screen.findByText('Couldn’t load the approval.');
    fireEvent.click(screen.getByRole('button', { name: 'Try Again' }));
    await waitFor(() => expect(broken.getApproval).toHaveBeenCalledTimes(2));
  });

  it('draws nothing outside a door', () => {
    const { container } = render(<ApprovalPanel />);
    expect(container.textContent).toBe('');
  });
});

describe('the Share dialog', () => {
  const shareClient = {
    listShareLinks: async () => ({ links: [], passwordSet: false }),
  } as unknown as IndexClient;
  const dialog = (
    <ShareDialog
      client={shareClient}
      item={{ id: 'i1', app: 'livedesign', kind: 'design', sharedVia: null, title: 'Logo' }}
      shareUrl={() => 'https://x.test'}
      onClose={() => {}}
    />
  );

  it('has an Approval tab for an Editor, opened first when the badge asked', async () => {
    let ctx: ReturnType<typeof useApprovalDoor> = null;
    function Grab() {
      ctx = useApprovalDoor();
      return null;
    }
    const openShare = vi.fn();
    const door = doorOf(fakeClient(null), { canRequest: true, openShare });
    const { rerender } = render(
      <ApprovalDoorProvider door={door}>
        <Grab />
      </ApprovalDoorProvider>,
    );
    act(() => ctx!.openApprovalTab!());
    rerender(
      <ApprovalDoorProvider door={door}>
        <Grab />
        {dialog}
      </ApprovalDoorProvider>,
    );
    const tab = await screen.findByRole('tab', { name: 'Approval' });
    expect(tab.getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(tab, { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: 'Passes' }).getAttribute('aria-selected')).toBe('true');
  });

  it('has no Approval tab for anyone else', () => {
    wrap(doorOf(fakeClient(null)), dialog);
    expect(screen.queryByRole('tab', { name: 'Approval' })).toBeNull();
  });
});
