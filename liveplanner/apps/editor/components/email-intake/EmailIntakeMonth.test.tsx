// @vitest-environment jsdom
// docs/specs/026-plan/email-to-board.md "Tiers", "What the dialog shows": with Pro on the dialog counts the owner's
// emails to boards this month to the owner alone, and once the read says the month is used says what happens to the
// mail that follows, with the offer for whoever is looking. With Pro off it shows none of it and asks nothing.
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EmailIntakesResponse } from '@liveplanner/api-schema';
import { setProForTests } from '@liveworkspace/subscription-ui/testing';
import { workbench } from '@liveworkspace/workbench/bindings';
import { ownerOf, proOnForTests, proService, withPro, type Who } from '@/test/pro';
import { EmailIntakeDialog, INTAKE_REREAD_MS } from './EmailIntakeDialog';

const client = vi.hoisted(() => ({
  readEmailIntakes: vi.fn(),
  saveEmailIntake: vi.fn(),
  newEmailIntakeAddress: vi.fn(),
  turnOffEmailIntake: vi.fn(),
}));
vi.mock('./email-intake-client', () => client);
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

proOnForTests();
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const SCOPE = { ownerId: 'user_1', projectId: 'p1', shareCode: null };
const TARGET = {
  typeId: 'task',
  status: 'inbox',
  cardType: 'Task',
  column: 'Inbox',
  showsOn: ['Board'],
};
const BASE: EmailIntakesResponse = {
  available: true,
  domain: 'in.liveplanner.app',
  boards: [
    { id: 'b1', title: 'Support', tabId: 't1', tabName: 'Board', column: 'Inbox', target: TARGET },
  ],
  types: [{ id: 'task', label: 'Task', columns: [{ status: 'inbox', name: 'Inbox' }] }],
  intakes: [
    {
      boardId: 'b1',
      address: 'board+abc@in.liveplanner.app',
      target: TARGET,
      senders: 'members',
      createdAt: 1,
      made: 50,
      refused: 0,
      dropped: 0,
      lastAt: null,
    },
  ],
};

async function open(who: Who, over: Partial<EmailIntakesResponse>, used = 500) {
  client.readEmailIntakes.mockResolvedValue({ ...BASE, owner: ownerOf(who), ...over });
  const service = proService(who, { emailToBoard: { used } });
  render(
    withPro(
      <EmailIntakeDialog scope={SCOPE} boardIds={['b1']} onClose={() => {}} />,
      service.fetcher,
    ),
  );
  await screen.findByRole('textbox', { name: 'Board address' });
  return service;
}

// The notice waits for the service to say who is looking, so its words never change under the reader.
const theNotice = () =>
  waitFor(() => {
    const found = document.querySelector<HTMLElement>('[data-email-intake-month] [data-callout]');
    if (!found) throw new Error('No notice yet');
    return found;
  });

const DAY = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
}).format(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() + 1, 1));
const UNTIL = `More are turned away until ${DAY}, and the sender is told.`;
const FULL = { month: { limit: 500, full: true } };

describe('Email to Board’s month', () => {
  it('counts the owner’s emails this month to the owner', async () => {
    await open('owner', { month: { limit: 500, full: false } }, 12);
    const meter = await screen.findByRole('meter', { name: 'Emails to boards this month' });
    expect(meter.getAttribute('aria-valuetext')).toBe('12 of 500');
    expect(document.querySelector('[data-email-intake-month] [data-callout]')).toBeNull();
    expect(screen.queryByRole('button', { name: /Upgrade/ })).toBeNull();
  });

  it('at the limit offers the owner the upgrade, and See All Limits opens Settings at Subscription', async () => {
    await open('owner', FULL);
    const notice = await theNotice();
    await waitFor(() =>
      expect(within(notice).getByRole('button', { name: 'Upgrade to Pro' })).toBeTruthy(),
    );
    expect(notice.textContent).toContain(
      `This month’s 500 emails to your boards have become cards. ${UNTIL} Pro takes 10,000 a month.`,
    );
    const asked = vi.fn((e: Event) => (e as CustomEvent<string>).detail);
    window.addEventListener(workbench.openSettingsEvent, asked);
    // Under the notice, not in it.
    expect(within(notice).queryByRole('button', { name: 'See All Limits' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'See All Limits' }));
    window.removeEventListener(workbench.openSettingsEvent, asked);
    expect(asked).toHaveReturnedWith('subscription');
  });

  it('says the month is used as soon as the owner’s count reaches it, before any mail is refused', async () => {
    await open('owner', { month: { limit: 500, full: false } }, 500);
    const notice = await theNotice();
    expect(notice.textContent).toContain(
      `This month’s 500 emails to your boards have become cards. ${UNTIL}`,
    );
    expect(screen.getByRole('meter').getAttribute('aria-valuetext')).toBe('500 of 500');
  });

  it('at the limit points a team’s member at an admin', async () => {
    await open('member', FULL);
    const notice = await theNotice();
    await waitFor(() =>
      expect(within(notice).getByRole('button', { name: 'Ask an Admin' })).toBeTruthy(),
    );
    expect(notice.textContent).toContain('A team admin can move this team to Pro for Teams.');
    expect(within(notice).queryByRole('button', { name: /Upgrade/ })).toBeNull();
  });

  it('at the limit tells a collaborator what happened and nothing more', async () => {
    const { calls } = await open('collaborator', FULL);
    await waitFor(() => expect(calls.some((c) => c.path.startsWith('/owner'))).toBe(true));
    const notice = await theNotice();
    expect(notice.textContent).toBe(
      `This plan’s owner has used this month’s emails to boards. ${UNTIL}`,
    );
    expect(screen.queryByRole('meter')).toBeNull();
    expect(within(notice).queryByRole('button')).toBeNull();
    expect(screen.queryByRole('button', { name: 'See All Limits' })).toBeNull();
  });

  it('reads again while an address is on, so a month found used shows its notice', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      await open('collaborator', { month: { limit: 500, full: false } });
      expect(document.querySelector('[data-email-intake-month]')).toBeNull();
      client.readEmailIntakes.mockResolvedValue({
        ...BASE,
        owner: ownerOf('collaborator'),
        ...FULL,
      });
      await act(async () => {
        vi.advanceTimersByTime(INTAKE_REREAD_MS);
      });
      await theNotice();
    } finally {
      vi.useRealTimers();
    }
  });

  it('with Pro off reads once, as before, whatever the addresses', async () => {
    setProForTests(false);
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      await open('owner', { month: { limit: 3, full: false } });
      const reads = client.readEmailIntakes.mock.calls.length;
      await act(async () => {
        vi.advanceTimersByTime(INTAKE_REREAD_MS * 2);
      });
      expect(client.readEmailIntakes.mock.calls.length).toBe(reads);
    } finally {
      vi.useRealTimers();
    }
  });

  it('with Pro off shows no meter and asks the service nothing', async () => {
    setProForTests(false);
    const { calls } = await open('owner', FULL);
    expect(document.querySelector('[data-email-intake-month]')).toBeNull();
    expect(screen.queryByRole('meter')).toBeNull();
    expect(calls).toEqual([]);
  });

  it('shows nothing of it when the api says nothing of the day (Pro off on the server)', async () => {
    client.readEmailIntakes.mockResolvedValue(BASE);
    const service = proService('owner');
    render(
      withPro(
        <EmailIntakeDialog scope={SCOPE} boardIds={['b1']} onClose={() => {}} />,
        service.fetcher,
      ),
    );
    await screen.findByRole('textbox', { name: 'Board address' });
    expect(document.querySelector('[data-email-intake-month]')).toBeNull();
  });
});
