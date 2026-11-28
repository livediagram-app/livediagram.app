// @vitest-environment jsdom
// A call about an item, in its Space (docs/specs/012-collaboration/calls-from-items.md): the Space reads whether it is
// a call once, says once a session what it is about and that it isn't recorded; Open Item brings back the item's tab;
// Invite is an account's, Wrap Up the host's; Wrap Up drafts from the floors' notes, writes with AI, and sends the
// summary to the chosen knowledgebase.
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SpaceCall } from '@liveworkspace/index-client';
import type { Tab } from '@livehuddle/document';

const { client, toast, track, ask } = vi.hoisted(() => ({
  client: {
    spaceCall: vi.fn(),
    callInvitePeople: vi.fn(),
    inviteToCall: vi.fn(),
    sendCallSummary: vi.fn(),
    listItems: vi.fn(),
  },
  toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() },
  track: vi.fn(),
  ask: vi.fn(),
}));
vi.mock('@liveworkspace/workbench/lib/index-client', () => ({ indexClient: client }));
vi.mock('@/hooks/ui/useToast', () => ({ useToast: () => toast }));
vi.mock('@/lib/telemetry', () => ({ track }));
vi.mock('@/lib/api/team-people', () => ({
  apiTeamMembers: vi.fn(async () => [
    { userId: 'user_cy', name: 'Cy', status: 'joined' },
    { userId: null, name: null, status: 'invited' },
  ]),
}));
vi.mock('@liveworkspace/ask/ui', () => ({
  askSender: () => ask,
  tabPassages: () => [],
}));

import { CallItemCard, openCallItem, shortName } from './CallItemCard';
import { mergeInvitees } from './InviteDialog';
import { callNotice, firstNotice, useSpaceCall } from './useSpaceCall';
import { summaryDraft, wrapUpNotes, WRAP_UP_NOTES_MAX } from './wrap-up-notes';

const CALL: SpaceCall = {
  id: 'ic_1',
  item: { app: 'livediagram', id: 'D1', title: 'Retro board', link: 'https://ld/document/D1' },
  host: true,
  live: true,
  startedAt: new Date(2026, 10, 23, 14, 0).getTime(),
  names: ['Ada', 'Ben'],
  summary: null,
  summaryDefault: { id: 'kb1', title: 'Team Wiki' },
};

const board = (id: string, x: number, y: number, notes: object[]) => ({
  id,
  type: 'shape',
  shape: 'notice-board',
  x,
  y,
  noticeNotes: notes,
});

const TABS = [
  {
    id: 't1',
    name: 'Floor 1',
    elements: [
      board('b', 10, 50, [{ text: 'Ship the login\nmore' }, { text: '   ' }]),
      board('a', 0, 0, [{ title: 'Agenda', text: 'the rest' }]),
      { id: 'c', type: 'shape', shape: 'desk', label: 'Not a note', x: 0, y: 10 },
      // A stored sticky is no note (it is dropped when the tab is read).
      { id: 'd', type: 'sticky', label: 'Gone', x: 0, y: 20 },
    ],
  },
] as unknown as Tab[];

beforeAll(async () => {
  await import('./InviteDialog');
  await import('./WrapUpDialog');
});

beforeEach(() => {
  sessionStorage.clear();
  client.listItems.mockResolvedValue({
    items: [
      { id: 'kb2', title: 'Other', access: 'edit' },
      { id: 'kb3', title: 'Read only', access: 'view' },
    ],
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

const flush = () => act(async () => {});

describe('wrap-up notes', () => {
  it('takes the Notice Boards’ notes in reading order, their first lines, up to the most', () => {
    expect(wrapUpNotes(TABS as never)).toEqual([
      { tab: 'Floor 1', lines: ['Agenda', 'Ship the login'] },
    ]);
    const many = [
      {
        id: 't',
        name: '',
        elements: [
          board(
            'e',
            0,
            0,
            Array.from({ length: 300 }, (_, i) => ({ text: `n${i}` })),
          ),
        ],
      },
      { id: 'u', name: 'More', elements: [board('x', 0, 0, [{ text: 'late' }])] },
    ];
    const notes = wrapUpNotes(many);
    expect(notes).toHaveLength(1);
    expect(notes[0]!.tab).toBe('Floor');
    expect(notes[0]!.lines).toHaveLength(WRAP_UP_NOTES_MAX);
  });

  it('drafts the facts, the notes by floor, and the headings to fill', () => {
    const { title, body } = summaryDraft(CALL, CALL.names, TABS);
    expect(title).toMatch(/^Retro board, /);
    expect(body).toContain('[Retro board](https://ld/document/D1)');
    expect(body).toContain('With Ada, Ben.');
    expect(body).toContain('- Agenda\n- Ship the login');
    expect(body).toContain('## Decisions');
    const two = summaryDraft(
      CALL,
      [],
      [
        ...(TABS as never[]),
        { id: 't2', name: 'Floor 2', elements: [board('z', 0, 0, [{ text: 'Two' }])] },
      ],
    );
    expect(two.body).toContain('### Floor 2');
    expect(two.body).not.toContain('With ');
    expect(summaryDraft(CALL, [], []).body).toContain('Nothing was written down');
  });
});

describe('useSpaceCall', () => {
  it('reads once, says the notice once a session, and reads again when asked', async () => {
    client.spaceCall.mockResolvedValue({ call: CALL });
    const { result } = renderHook(() => useSpaceCall('S1', { code: 'c1' }));
    await flush();
    expect(client.spaceCall).toHaveBeenCalledWith(
      'S1',
      expect.objectContaining({ share: { code: 'c1' } }),
    );
    expect(result.current.call).toEqual(CALL);
    expect(toast.info).toHaveBeenCalledWith(callNotice(CALL));
    expect(callNotice(CALL)).toBe('This call is about Retro board. It isn’t recorded.');
    act(() => result.current.reread());
    await flush();
    expect(client.spaceCall).toHaveBeenCalledTimes(2);
    expect(toast.info).toHaveBeenCalledTimes(1);
    expect(firstNotice('S1')).toBe(false);
  });

  it('reads nothing without a Space, and shows nothing for one that is no call or a failed read', async () => {
    const none = renderHook(() => useSpaceCall(null, null));
    await flush();
    expect(client.spaceCall).not.toHaveBeenCalled();
    expect(none.result.current.call).toBeNull();
    client.spaceCall.mockResolvedValueOnce({ call: null });
    const plain = renderHook(() => useSpaceCall('S2', null));
    await flush();
    expect(plain.result.current.call).toBeNull();
    client.spaceCall.mockRejectedValueOnce(new Error('offline'));
    const failed = renderHook(() => useSpaceCall('S3', null));
    await flush();
    expect(failed.result.current.call).toBeNull();
    expect(toast.info).not.toHaveBeenCalled();
  });
});

describe('the call card', () => {
  const card = (over: Partial<Parameters<typeof CallItemCard>[0]> = {}) =>
    render(
      <CallItemCard
        call={CALL}
        spaceId="S1"
        accountId="user_ada"
        mayInvite
        tabs={TABS}
        onSent={vi.fn()}
        {...over}
      />,
    );

  it('shows the host Open Item, Invite and Wrap Up; a Participant Invite; a Viewer and a guest Open Item alone', () => {
    const { unmount } = card();
    expect(screen.getByText('Retro board')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Invite/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Wrap Up/ })).toBeTruthy();
    unmount();
    const member = card({ call: { ...CALL, host: false } });
    expect(screen.queryByRole('button', { name: /Wrap Up/ })).toBeNull();
    expect(screen.getByRole('button', { name: /Invite/ })).toBeTruthy();
    member.unmount();
    // A Viewer of the Space (Work Tracker 1458): Open Item alone, no Invite, as the index refuses theirs.
    const viewer = card({ call: { ...CALL, host: false }, mayInvite: false });
    expect(screen.queryByRole('button', { name: /Invite/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Wrap Up/ })).toBeNull();
    expect(screen.getByText('Retro board')).toBeTruthy();
    viewer.unmount();
    card({ accountId: null });
    expect(screen.queryByRole('button', { name: /Invite/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Wrap Up/ })).toBeNull();
    expect(screen.getByText('Retro board')).toBeTruthy();
  });

  it('cuts a long name', () => {
    expect(shortName('A very long item name indeed, yes')).toBe('A very long item name…');
    expect(shortName('  ')).toBe('Untitled');
  });

  it("Open Item brings back the item's tab, or opens it", () => {
    const tab = {
      focus: vi.fn(),
      get location(): Location {
        throw new DOMException('x', 'SecurityError');
      },
    };
    const open = vi.spyOn(window, 'open').mockReturnValue(tab as unknown as Window);
    fireEvent.click(card().container.querySelector('[data-call-item]')!);
    expect(open).toHaveBeenCalledWith('', 'lw-item-D1');
    expect(tab.focus).toHaveBeenCalled();
    expect(track).toHaveBeenCalledWith('UI', 'Opened', 'CallItem');
    open.mockReturnValue(null);
    openCallItem(CALL);
    expect(open).toHaveBeenLastCalledWith('https://ld/document/D1', '_blank', 'noopener');
  });

  it('invites the people picked, the team first', async () => {
    client.callInvitePeople.mockResolvedValue({
      teamId: 'team_1',
      people: [
        { id: 'user_ben', via: 'link', name: 'Ben' },
        { id: 'user_cy', via: 'link', name: 'Cy again' },
      ],
    });
    client.inviteToCall.mockResolvedValue({ invited: 2 });
    card();
    fireEvent.click(screen.getByRole('button', { name: /Invite/ }));
    expect(await screen.findByText('Ben')).toBeTruthy();
    expect(screen.getByText('In the team')).toBeTruthy();
    fireEvent.click(screen.getByLabelText(/Ben/));
    fireEvent.click(screen.getByLabelText(/Cy/));
    fireEvent.click(screen.getByRole('button', { name: 'Send 2 Invites' }));
    await flush();
    expect(client.inviteToCall).toHaveBeenCalledWith('S1', { people: ['user_ben', 'user_cy'] });
    expect(toast.success).toHaveBeenCalledWith('Invited 2 people');
    expect(track).toHaveBeenCalledWith('UI', 'Created', 'CallInvite');
  });

  it('says when nobody else can be invited, or the people could not be read', async () => {
    client.callInvitePeople.mockResolvedValueOnce({ teamId: null, people: [] });
    const first = card();
    fireEvent.click(screen.getByRole('button', { name: /Invite/ }));
    expect(await screen.findByText(/Nobody else can open the item yet/)).toBeTruthy();
    first.unmount();
    client.callInvitePeople.mockRejectedValueOnce(new Error('x'));
    card();
    fireEvent.click(screen.getByRole('button', { name: /Invite/ }));
    expect(await screen.findByText(/couldn’t be read/)).toBeTruthy();
  });

  it('merges invitees once each, never oneself', () => {
    expect(
      mergeInvitees(
        [
          { userId: 'user_ada', name: 'Ada', status: 'joined' },
          { userId: 'user_cy', name: null, status: 'joined' },
        ],
        [
          { id: 'user_cy', name: 'Cy', via: 'link' },
          { id: 'user_owner', name: null, via: 'owner' },
        ],
        'user_ada',
      ),
    ).toEqual([
      { id: 'user_cy', name: 'Teammate', via: 'team' },
      { id: 'user_owner', name: 'Someone', via: 'owner' },
    ]);
  });
});

describe('Wrap Up', () => {
  const open = () => {
    const onSent = vi.fn();
    render(
      <CallItemCard
        call={CALL}
        spaceId="S1"
        accountId="user_ada"
        mayInvite
        tabs={TABS}
        onSent={onSent}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Wrap Up/ }));
    return onSent;
  };

  it('drafts the summary, suggests the default knowledgebase, and sends it', async () => {
    client.sendCallSummary.mockResolvedValue({ summary: { title: 'T', link: 'https://kb/p1' } });
    const onSent = open();
    const select = await screen.findByLabelText<HTMLSelectElement>('Send To');
    await waitFor(() => expect(select.disabled).toBe(false));
    expect(select.value).toBe('kb1');
    expect(screen.getByText(/Team Wiki \(suggested\)/)).toBeTruthy();
    expect(screen.queryByText('Read only')).toBeNull();
    expect(screen.getByLabelText<HTMLTextAreaElement>('Summary').value).toContain('Ship the login');
    fireEvent.click(screen.getByRole('button', { name: 'Send Summary' }));
    await flush();
    expect(client.sendCallSummary).toHaveBeenCalledWith(
      'S1',
      expect.objectContaining({
        knowledgebase: 'kb1',
        title: expect.stringMatching(/^Retro board/),
      }),
    );
    expect(onSent).toHaveBeenCalled();
    expect(track).toHaveBeenCalledWith('UI', 'Created', 'CallSummary');
    expect(screen.getByRole('link', { name: 'T' }).getAttribute('href')).toBe('https://kb/p1');
    const win = vi.spyOn(window, 'open').mockReturnValue(null);
    fireEvent.click(screen.getByRole('button', { name: 'Open Page' }));
    expect(win).toHaveBeenCalledWith('https://kb/p1', '_blank', 'noopener');
  });

  it('writes with AI, and keeps the draft when AI refuses', async () => {
    ask.mockImplementationOnce(
      async (_body: unknown, { onDelta }: { onDelta: (t: string) => void }) => {
        onDelta('## Summary');
        return { type: 'done', text: '## Summary\n\nDone.' };
      },
    );
    open();
    fireEvent.click(await screen.findByRole('button', { name: 'Write With AI' }));
    await flush();
    expect(screen.getByLabelText<HTMLTextAreaElement>('Summary').value).toBe('## Summary\n\nDone.');
    expect(track).toHaveBeenCalledWith('UI', 'Used', 'CallSummaryAi');
    ask.mockResolvedValueOnce({ type: 'error', kind: 'limit', message: 'Out of AI today.' });
    fireEvent.click(screen.getByRole('button', { name: 'Write With AI' }));
    await flush();
    expect(toast.error).toHaveBeenCalledWith('Out of AI today.');
  });

  it('offers no Send Actions to Plan, and says when the summary could not go', async () => {
    client.sendCallSummary.mockRejectedValue(new Error('422'));
    open();
    await screen.findByRole('button', { name: 'Send Summary' });
    expect(screen.queryByRole('button', { name: 'Send Actions to Plan' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Send Summary' }));
    await flush();
    expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/couldn’t be sent/));
  });

  it('offers nothing to send where no knowledgebase can be edited', async () => {
    client.listItems.mockRejectedValueOnce(new Error('x'));
    render(
      <CallItemCard
        call={{ ...CALL, summaryDefault: null }}
        spaceId="S1"
        accountId="user_ada"
        mayInvite
        tabs={[]}
        onSent={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Wrap Up/ }));
    expect(await screen.findByText('No knowledgebase you can edit')).toBeTruthy();
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Send Summary' }).disabled).toBe(
      true,
    );
  });
});
