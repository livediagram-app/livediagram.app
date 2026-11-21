// @vitest-environment jsdom
// docs/specs/026-plan/automations.md "Email Received" (Work Tracker 1173): the plan's addresses are read once as the
// panel first opens, a board without one is marked in the Board picker, and Turn On Email to Board opens Email to
// Board over the builder on that board, reading the addresses again when it closes.
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Suspense, lazy, useState, type ComponentType } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EmailIntakesResponse } from '@liveplanner/api-schema';
import type { AutomationTrigger } from '@liveplanner/items';
import type { OutlineBoard } from '../automation-outline';
import { EmailAddressesProvider, useEmailAddressesState } from '../email-addresses';
import { EmailTriggerFields, boardChoices, emailBoardNote } from './EmailTriggerFields';

// Counts the reads; `failNext` makes the next one fail as a 403 would.
const read = vi.fn<() => Promise<EmailIntakesResponse>>();
let failNext = false;
vi.mock('../../email-intake/email-intake-client', () => ({
  readEmailIntakes: (...args: unknown[]) => {
    const answer = read(...(args as []));
    return failNext ? Promise.reject(new Error('403')) : answer;
  },
}));
// The dialog, as the builder draws it: its boards, and its close.
vi.mock('../../email-intake/EmailIntakeDialog', () => ({
  EmailIntakeDialog: ({ boardIds, onClose }: { boardIds: string[]; onClose: () => void }) => (
    <div role="dialog" aria-label="Email to Board">
      {boardIds.join(',')}
      <button type="button" onClick={onClose}>
        Close Email to Board
      </button>
    </div>
  ),
}));
// next/dynamic as React.lazy, so the dialog's loader runs as it would.
vi.mock('next/dynamic', () => ({
  default: (load: () => Promise<ComponentType<Record<string, unknown>>>) => {
    const Lazy = lazy(() => load().then((C) => ({ default: C })));
    return function Dynamic(props: Record<string, unknown>) {
      return (
        <Suspense fallback={null}>
          <Lazy {...props} />
        </Suspense>
      );
    };
  },
}));

const BOARDS: OutlineBoard[] = [
  { id: 'b1', tabId: 't1', tabName: 'Support', title: 'Inbox', filters: [] },
  { id: 'b2', tabId: 't2', tabName: 'Sales', title: 'Inbox', filters: [] },
  { id: 'b3', tabId: 't2', tabName: 'Sales', title: 'Leads', filters: [] },
];

const intakes = (
  addressed: string[],
  over: Partial<EmailIntakesResponse> = {},
): EmailIntakesResponse => ({
  available: true,
  domain: 'mail.example.com',
  intakes: addressed.map((boardId) => ({
    boardId,
    address: `board+${boardId}@mail.example.com`,
    target: null,
    senders: 'members',
    createdAt: 0,
    made: 0,
    refused: 0,
    dropped: 0,
    lastAt: null,
  })),
  // b4 is a board the api knows that the rule's outline does not; a board only the outline has is never marked.
  boards: ['b1', 'b2', 'b4'].map((id) => ({
    id,
    title: 'Inbox',
    tabId: 't1',
    tabName: 'Support',
    column: 'To Do',
    target: null,
  })),
  types: [],
  ...over,
});

let latest: AutomationTrigger;
function Fields({
  trigger,
  ownerId = 'u1',
  boards = BOARDS,
}: {
  trigger: AutomationTrigger & { kind: 'email_received' };
  ownerId?: string;
  boards?: OutlineBoard[];
}) {
  const state = useEmailAddressesState({ ownerId, itemId: 'p1', shareCode: null });
  const [t, setT] = useState(trigger);
  const [shown, setShown] = useState(true);
  return (
    <EmailAddressesProvider state={state}>
      <button type="button" onClick={() => setShown((s) => !s)}>
        Toggle Panel
      </button>
      {shown ? (
        <EmailTriggerFields
          trigger={t}
          boards={boards}
          onChange={(next) => {
            latest = next;
            setT(next as typeof t);
          }}
        />
      ) : null}
    </EmailAddressesProvider>
  );
}

const options = () =>
  [...screen.getByRole('combobox', { name: 'Board' }).querySelectorAll('option')].map(
    (o) => o.textContent,
  );

beforeEach(() => {
  read.mockReset();
  failNext = false;
});
afterEach(cleanup);

describe('Email Received board addresses', () => {
  it('reads the addresses once as the panel opens, and marks each board without one', async () => {
    read.mockResolvedValue(intakes(['b1']));
    render(<Fields trigger={{ kind: 'email_received' }} />);
    await waitFor(() => expect(options()).toContain('Inbox · Sales · No Address'));
    expect(options()).toEqual([
      'Any Board',
      'Inbox · Support',
      'Inbox · Sales · No Address',
      'Leads',
    ]);
    expect(read).toHaveBeenCalledWith({ ownerId: 'u1', projectId: 'p1', shareCode: null });
    // Closed and opened again in the same builder: no second read.
    fireEvent.click(screen.getByRole('button', { name: 'Toggle Panel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Toggle Panel' }));
    expect(read).toHaveBeenCalledTimes(1);
    // A board with an address, or Any Board while one has one: the plain note.
    expect(screen.getByText(/Only boards with Email to Board turned on get email/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Turn On Email to Board' })).toBeNull();
  });

  it('offers Turn On Email to Board for a picked board with no address, and reads again once it closes', async () => {
    read.mockResolvedValue(intakes(['b1']));
    render(<Fields trigger={{ kind: 'email_received' }} />);
    await waitFor(() => expect(options()).toContain('Inbox · Sales · No Address'));
    fireEvent.change(screen.getByRole('combobox', { name: 'Board' }), { target: { value: 'b2' } });
    expect(latest).toEqual({ kind: 'email_received', board: 'b2' });
    expect(
      screen.getByText(/Inbox · Sales has no email address yet, so no email reaches this rule\./),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Turn On Email to Board' }));
    const dialog = await screen.findByRole('dialog', { name: 'Email to Board' });
    expect(dialog.textContent).toContain('b2');
    read.mockResolvedValue(intakes(['b1', 'b2']));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Close Email to Board' }));
    });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(read).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(options()).toContain('Inbox · Sales'));
    expect(screen.queryByRole('button', { name: 'Turn On Email to Board' })).toBeNull();
  });

  it('says no board has an address on Any Board, opening Email to Board on every board', async () => {
    read.mockResolvedValue(intakes([]));
    render(<Fields trigger={{ kind: 'email_received' }} boards={BOARDS.slice(0, 2)} />);
    expect(await screen.findByText(/No board has an email address yet\./)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Turn On Email to Board' }));
    expect((await screen.findByRole('dialog')).textContent).toContain('b1,b2');
  });

  it('marks nothing on a server that takes no mail, after a failed read, or with no owner to ask as', async () => {
    read.mockResolvedValue(intakes([], { available: false, domain: null }));
    const off = render(<Fields trigger={{ kind: 'email_received', board: 'b2' }} />);
    await waitFor(() => expect(read).toHaveBeenCalledTimes(1));
    await act(async () => {});
    expect(options()).not.toContain('Inbox · Sales · No Address');
    off.unmount();

    failNext = true;
    const failed = render(<Fields trigger={{ kind: 'email_received', board: 'b2' }} />);
    await waitFor(() => expect(read).toHaveBeenCalledTimes(2));
    await act(async () => {});
    expect(options()).not.toContain('Inbox · Sales · No Address');
    expect(screen.getByText(/Only boards with Email to Board turned on get email/)).toBeTruthy();
    failed.unmount();

    render(<Fields trigger={{ kind: 'email_received' }} ownerId="" />);
    expect(read).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('button', { name: 'Turn On Email to Board' })).toBeNull();
  });
});

describe('emailBoardNote', () => {
  const named = boardChoices(BOARDS);
  it('names the picked board without an address, or none on Any Board, else nothing', () => {
    expect(emailBoardNote('b3', named, new Set(['b3']))).toEqual({
      text: 'Leads has no email address yet, so no email reaches this rule.',
      turnOn: ['b3'],
    });
    expect(emailBoardNote('b1', named, new Set(['b3']))).toBeNull();
    // A board no longer here is the gone pick's to say.
    expect(emailBoardNote('gone', named, new Set(['gone']))).toBeNull();
    expect(emailBoardNote(undefined, named, new Set(['b1', 'b2']))).toBeNull();
    expect(emailBoardNote(undefined, named, new Set(['b1', 'b2', 'b3']))).toEqual({
      text: 'No board has an email address yet.',
      turnOn: ['b1', 'b2', 'b3'],
    });
    expect(emailBoardNote(undefined, [], new Set())).toBeNull();
  });
});
