// @vitest-environment jsdom
// docs/specs/026-plan/email-to-board.md "The dialog": the plan's addresses read fresh, a board in its two states (Off,
// On), Turn On with Who Can Send, Copy Address, Who Can Send saving at once (and going back when the save fails), New
// Address and Turn Off behind their confirms, the counts line, the board picker and the failures. The tab menu's row
// draws only with the door the host sets.
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EmailIntake, EmailIntakeBoard, EmailIntakesResponse } from '@liveplanner/api-schema';
import { EmailIntakeDialog, intakeCountsLine } from './EmailIntakeDialog';
import { EmailIntakeHost } from './EmailIntakeHost';
import { EmailIntakeMenuRow } from './EmailIntakeMenuRow';

const client = vi.hoisted(() => ({
  readEmailIntakes: vi.fn(),
  saveEmailIntake: vi.fn(),
  newEmailIntakeAddress: vi.fn(),
  turnOffEmailIntake: vi.fn(),
}));
vi.mock('./email-intake-client', () => client);
const track = vi.hoisted(() => vi.fn());
vi.mock('@/lib/telemetry', () => ({ track }));

const SCOPE = { ownerId: 'user_1', projectId: 'p1', shareCode: null };
const BOARD: EmailIntakeBoard = {
  id: 'b1',
  title: 'Support',
  tabId: 't1',
  tabName: 'Board',
  column: 'Inbox',
};
const OTHER: EmailIntakeBoard = { ...BOARD, id: 'b2', title: 'Bugs', column: 'Triage' };
const ADDRESS = 'board-abcdefghijklmnopqrstuvwxyz@in.liveplanner.app';
const on = (i: Partial<EmailIntake> = {}): EmailIntake => ({
  boardId: 'b1',
  address: ADDRESS,
  senders: 'members',
  createdAt: 1,
  made: 0,
  refused: 0,
  dropped: 0,
  lastAt: null,
  ...i,
});
const writeText = vi.fn();

const open = async (r: Partial<EmailIntakesResponse>, boardIds: string[] = ['b1']) => {
  client.readEmailIntakes.mockResolvedValue({
    available: true,
    domain: 'in.liveplanner.app',
    intakes: [],
    boards: [BOARD],
    ...r,
  });
  const onClose = vi.fn();
  render(<EmailIntakeDialog scope={SCOPE} boardIds={boardIds} onClose={onClose} />);
  await waitFor(() => expect(stateOf()).not.toBe('loading'));
  return onClose;
};
const stateOf = () =>
  document.querySelector('[data-email-intake-state]')!.getAttribute('data-email-intake-state');
const radio = (name: string) => screen.getByRole('radio', { name: new RegExp(`^${name}`) });

beforeEach(() => {
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('Email to Board', () => {
  it('turns an address on with Who Can Send chosen', async () => {
    await open({});
    expect(stateOf()).toBe('off');
    expect(screen.getByText(/becomes a card in/).textContent).toContain('Inbox');
    expect(radio('Plan Members')).toHaveProperty('checked', true);
    fireEvent.click(radio('Anyone with the Address'));
    client.saveEmailIntake.mockResolvedValue({ intake: on({ senders: 'anyone' }) });
    fireEvent.click(screen.getByRole('button', { name: 'Turn On' }));
    await waitFor(() => expect(stateOf()).toBe('on'));
    expect(client.saveEmailIntake).toHaveBeenCalledWith(SCOPE, 'b1', 'anyone');
    expect(track).toHaveBeenCalledWith('Plan', 'Created', 'EmailIntake');
    expect(screen.getByRole('textbox', { name: 'Board address' })).toHaveProperty('value', ADDRESS);
    expect(screen.getByText('No mail yet.')).toBeTruthy();
  });

  it('copies the address', async () => {
    await open({ intakes: [on()] });
    fireEvent.click(screen.getByRole('button', { name: 'Copy Address' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Copied' })).toBeTruthy());
    expect(writeText).toHaveBeenCalledWith(ADDRESS);
    expect(track).toHaveBeenCalledWith('Plan', 'Copied', 'EmailIntake');
  });

  it('selects the field when there is no clipboard', async () => {
    writeText.mockRejectedValueOnce(new Error('denied'));
    await open({ intakes: [on()] });
    fireEvent.click(screen.getByRole('button', { name: 'Copy Address' }));
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Board address' })),
    );
  });

  it('saves Who Can Send at once, and goes back when the save fails', async () => {
    await open({ intakes: [on()] });
    client.saveEmailIntake.mockResolvedValueOnce({ intake: on({ senders: 'anyone' }) });
    fireEvent.click(radio('Anyone with the Address'));
    await waitFor(() => expect(radio('Anyone with the Address')).toHaveProperty('checked', true));
    expect(track).toHaveBeenCalledWith('Plan', 'Changed', 'EmailIntakeSenders');
    client.saveEmailIntake.mockRejectedValueOnce(new Error('down'));
    fireEvent.click(radio('Plan Members'));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/Couldn’t save/));
    expect(radio('Anyone with the Address')).toHaveProperty('checked', true);
  });

  it('makes a new address behind its confirm', async () => {
    await open({ intakes: [on({ made: 3, refused: 1, lastAt: Date.now() - 7_200_000 })] });
    expect(screen.getByText(/^3 cards made · 1 refused · Last card 2 hours ago$/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'New Address' }));
    expect(screen.getByText('Make a new address?')).toBeTruthy();
    const next = 'board-zyxwvutsrqponmlkjihgfedcba@in.liveplanner.app';
    client.newEmailIntakeAddress.mockResolvedValue({ intake: on({ address: next }) });
    fireEvent.click(screen.getAllByRole('button', { name: 'New Address' }).at(-1)!);
    await waitFor(() =>
      expect(screen.getByRole('textbox', { name: 'Board address' })).toHaveProperty('value', next),
    );
    expect(track).toHaveBeenCalledWith('Plan', 'Changed', 'EmailIntakeAddress');
  });

  it('turns off behind its confirm, keeping Who Can Send for next time', async () => {
    await open({ intakes: [on({ senders: 'anyone' })] });
    fireEvent.click(screen.getByRole('button', { name: 'Turn Off' }));
    expect(screen.getByText('Turn off this address?')).toBeTruthy();
    client.turnOffEmailIntake.mockResolvedValue(undefined);
    fireEvent.click(screen.getAllByRole('button', { name: 'Turn Off' }).at(-1)!);
    await waitFor(() => expect(stateOf()).toBe('off'));
    expect(radio('Anyone with the Address')).toHaveProperty('checked', true);
    expect(track).toHaveBeenCalledWith('Plan', 'Ended', 'EmailIntake');
  });

  it('cancels a confirm and says when a write fails', async () => {
    await open({ intakes: [on()] });
    fireEvent.click(screen.getByRole('button', { name: 'Turn Off' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByText('Turn off this address?')).toBeNull();
    client.newEmailIntakeAddress.mockRejectedValue(new Error('down'));
    fireEvent.click(screen.getByRole('button', { name: 'New Address' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'New Address' }).at(-1)!);
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/Couldn’t save/));
    expect(stateOf()).toBe('on');
  });

  it('picks among the tab’s boards', async () => {
    await open({ boards: [BOARD, OTHER], intakes: [on()] }, ['b1', 'b2']);
    const picker = screen.getByRole('combobox', { name: 'Board' });
    expect(screen.getByRole('option', { name: 'Support (on)' })).toBeTruthy();
    fireEvent.change(picker, { target: { value: 'b2' } });
    expect(stateOf()).toBe('off');
    expect(screen.getByText(/becomes a card in/).textContent).toContain('Triage');
  });

  it('says what stands in the way', async () => {
    await open({ available: false, domain: null, boards: [] });
    expect(stateOf()).toBe('unavailable');
    expect(screen.getByText('Email to Board isn’t set up on this server.')).toBeTruthy();
    cleanup();
    await open({ boards: [{ ...BOARD, column: null }] });
    expect(screen.getByText('This board has no column for new cards.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Turn On' })).toBeNull();
    cleanup();
    await open({ boards: [] });
    expect(stateOf()).toBe('no-board');
  });

  it('says when it could not read, and tries again', async () => {
    client.readEmailIntakes.mockRejectedValueOnce(new Error('down'));
    render(<EmailIntakeDialog scope={SCOPE} boardIds={['b1']} onClose={() => {}} />);
    await waitFor(() => expect(stateOf()).toBe('error'));
    client.readEmailIntakes.mockResolvedValue({
      available: true,
      domain: 'x',
      intakes: [],
      boards: [BOARD],
    });
    fireEvent.click(screen.getByRole('button', { name: 'Try Again' }));
    await waitFor(() => expect(stateOf()).toBe('off'));
  });

  it('closes on Done', async () => {
    const onClose = await open({ intakes: [on()] });
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(onClose).toHaveBeenCalled();
  });
});

describe('the counts line', () => {
  it('counts what came, and when the last card was made', () => {
    const now = 10_000_000;
    expect(intakeCountsLine(on(), now)).toBe('No mail yet.');
    expect(intakeCountsLine(on({ made: 1, lastAt: now - 60_000 }), now)).toBe(
      '1 card made · Last card 1 min ago',
    );
    expect(intakeCountsLine(on({ refused: 2, dropped: 1 }), now)).toBe(
      '0 cards made · 2 refused · 1 dropped',
    );
  });
});

describe('the tab menu row', () => {
  it('draws only for someone the host lets in, and opens the dialog', async () => {
    client.readEmailIntakes.mockResolvedValue({
      available: true,
      domain: 'x',
      intakes: [],
      boards: [BOARD],
    });
    const { rerender } = render(
      <EmailIntakeHost scope={null} boardIds={['b1']}>
        <EmailIntakeMenuRow onClose={() => {}} />
      </EmailIntakeHost>,
    );
    expect(screen.queryByText('Email to Board…')).toBeNull();
    rerender(
      <EmailIntakeHost scope={SCOPE} boardIds={[]}>
        <EmailIntakeMenuRow onClose={() => {}} />
      </EmailIntakeHost>,
    );
    expect(screen.queryByText('Email to Board…')).toBeNull();
    const onClose = vi.fn();
    rerender(
      <EmailIntakeHost scope={SCOPE} boardIds={['b1']}>
        <EmailIntakeMenuRow onClose={onClose} />
      </EmailIntakeHost>,
    );
    fireEvent.click(screen.getByText('Email to Board…'));
    expect(onClose).toHaveBeenCalled();
    expect(track).toHaveBeenCalledWith('UI', 'Opened', 'EmailIntake');
    await waitFor(() => expect(screen.getByRole('dialog')).toBeTruthy());
  });
});
