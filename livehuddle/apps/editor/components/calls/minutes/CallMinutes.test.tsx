// @vitest-environment jsdom
// docs/specs/012-collaboration/call-minutes.md "What people see": the Space's Call Minutes in Collaborators, the
// one-time notice that the month is running low, and what each person is shown when it is used. The owner (or a team
// admin) is offered the upgrade, a team's member is pointed at an admin, and everyone else, guests included, is told
// calls are paused and nothing more. With Pro off none of it is drawn or asked for.
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CallMinutesResponse } from '@livehuddle/api-schema';
import { setProForTests } from '@liveworkspace/subscription-ui/testing';
import {
  callMinutes,
  noteCallMinutesUsed,
  noteCallSessionMinutes,
  receiveCallMinutes,
  resetCallMinutes,
} from '@/lib/calls/call-minutes-store';
import { resetCallSelf, setCallActions, setCallSelf } from '@/lib/calls/calls-store';
import { ownerOf, proOnForTests, proService, withPro, type Who } from '@/test/pro';
import { CallStripGroup } from '../CallStripGroup';
import { CallMinutesHost } from './CallMinutesHost';
import { CallMinutesLow } from './CallMinutesLow';
import { CallMinutesSection } from './CallMinutesSection';
import { CallMinutesUsedDialog } from './CallMinutesUsedDialog';

const api = vi.hoisted(() => ({ apiCallMinutes: vi.fn() }));
vi.mock('@/lib/api/calls', async (load) => ({
  ...(await load<typeof import('@/lib/api/calls')>()),
  apiCallMinutes: api.apiCallMinutes,
}));

proOnForTests();
// A fixed day, so the month starts again on the first of December.
const FIRST = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
}).format(Date.UTC(2026, 11, 1));
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], now: Date.UTC(2026, 10, 20, 12) });
  api.apiCallMinutes.mockReset();
});
afterEach(() => {
  cleanup();
  act(() => {
    resetCallMinutes();
    resetCallSelf();
  });
  vi.useRealTimers();
});

const CALLER = { ownerId: 'o', documentId: 'd', shareCode: null };
const reading = (who: Who, over: Partial<CallMinutesResponse & { metered: true }> = {}) =>
  ({
    metered: true,
    owner: ownerOf(who),
    used: 240,
    limit: 1000,
    low: false,
    paused: false,
    ...over,
  }) satisfies CallMinutesResponse;

describe('the month is used', () => {
  // `told`: what the server told this person. The owner and the owning team are told the numbers; a signed-in
  // collaborator is told whose month it is and no number; a signed-out visitor is told neither.
  function open(
    who: Who,
    told: { owner?: string | null; used?: number | null; guest?: boolean } = {},
  ) {
    const onClose = vi.fn();
    const service = proService(who);
    const numbers = told.used === undefined ? 1000 : told.used;
    render(
      withPro(
        <CallMinutesUsedDialog
          owner={told.owner === undefined ? ownerOf(who) : told.owner}
          guest={told.guest ?? false}
          caller={CALLER}
          used={numbers}
          limit={numbers}
          onClose={onClose}
        />,
        service.fetcher,
        who,
      ),
    );
    return { ...service, onClose };
  }

  it('reads the owner their numbers from the api when the room’s word brought none', async () => {
    api.apiCallMinutes.mockResolvedValue(reading('owner', { used: 1000, paused: true }));
    open('owner', { used: null });
    const meter = await screen.findByRole('meter', { name: 'Call Minutes' });
    expect(meter.getAttribute('aria-valuetext')).toBe('1,000 of 1,000');
    expect(api.apiCallMinutes).toHaveBeenCalledWith(CALLER);
    expect(screen.getByRole('button', { name: 'Upgrade to Pro' })).toBeTruthy();
  });

  it('tells a signed-out visitor calls are paused, with no owner named and nothing asked of the api', async () => {
    open('guest', { owner: null, used: null });
    expect(await screen.findByRole('heading', { name: 'Calls Are Paused' })).toBeTruthy();
    expect(screen.getByText(`Calls are paused in this Space until ${FIRST}.`)).toBeTruthy();
    expect(screen.queryByRole('meter')).toBeNull();
    expect(screen.queryByRole('button', { name: /Upgrade|Ask an Admin|See Pro/ })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Sign In' })).toBeNull();
    expect(api.apiCallMinutes).not.toHaveBeenCalled();
  });

  it('in a guest’s Space says to sign in to keep it, and offers no upgrade to anyone', async () => {
    open('collaborator', { owner: null, used: null, guest: true });
    expect(await screen.findByRole('heading', { name: 'Calls Are Paused' })).toBeTruthy();
    expect(
      screen.getByText(
        `Calls are paused in this Space until ${FIRST}. Sign in to keep this Space as your own.`,
      ),
    ).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Sign In' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Upgrade|Ask an Admin|See Pro/ })).toBeNull();
    expect(screen.queryByRole('meter')).toBeNull();
  });

  it('offers the owner the upgrade, beside the count and a way back', async () => {
    const { onClose } = open('owner');
    expect(
      await screen.findByRole('heading', { name: 'This Month’s Call Minutes Are Used' }),
    ).toBeTruthy();
    expect(
      screen.getByText(
        `Calls start again on ${FIRST}. The Space, its chat and everything on its walls still work. Pro has 5,000.`,
      ),
    ).toBeTruthy();
    const meter = screen.getByRole('meter', { name: 'Call Minutes' });
    expect(meter.getAttribute('aria-valuetext')).toBe('1,000 of 1,000');
    expect(screen.getByRole('button', { name: 'Upgrade to Pro' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Back to the Space' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('offers a team admin the team’s upgrade', async () => {
    open('admin');
    expect(await screen.findByRole('button', { name: 'Upgrade Team' })).toBeTruthy();
    expect(screen.getByText(/Pro for Teams has 2,500 a member\./)).toBeTruthy();
  });

  it('points a team’s member at an admin, with no upgrade of their own', async () => {
    open('member');
    expect(await screen.findByRole('button', { name: 'Ask an Admin' })).toBeTruthy();
    expect(screen.getByText(/A team admin can move this team to Pro for Teams\./)).toBeTruthy();
    expect(screen.getByRole('meter', { name: 'Call Minutes' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Upgrade/ })).toBeNull();
  });

  it.each(['collaborator', 'guest'] as const)(
    'tells a %s only that calls are paused: no offer, no count, nothing of the owner',
    async (who) => {
      const { onClose } = open(who);
      expect(await screen.findByRole('heading', { name: 'Calls Are Paused' })).toBeTruthy();
      expect(screen.getByText(`Calls are paused in this Space until ${FIRST}.`)).toBeTruthy();
      expect(screen.queryByRole('meter')).toBeNull();
      expect(screen.queryByRole('button', { name: /Upgrade|Ask an Admin|See Pro/ })).toBeNull();
      expect(document.body.textContent).not.toMatch(/Pro has|1,000|Free/);
      fireEvent.click(screen.getByRole('button', { name: 'Back to the Space' }));
      expect(onClose).toHaveBeenCalledOnce();
    },
  );
});

describe('in a call, running low', () => {
  function show(who: Who, read: CallMinutesResponse = reading(who, { used: 920, low: true })) {
    api.apiCallMinutes.mockResolvedValue(read);
    const service = proService(who);
    return render(
      withPro(<CallMinutesLow owner={ownerOf(who)} caller={CALLER} />, service.fetcher, who),
    );
  }

  it('tells the owner how many are left and what Pro has, once', async () => {
    const first = show('owner');
    expect(await screen.findByText('80 call minutes left this month. Pro has 5,000.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'See Pro' })).toBeTruthy();
    expect(api.apiCallMinutes).toHaveBeenCalledWith(CALLER);
    first.unmount();
    // Later the same month, in the same browser: not shown, and not asked for, again.
    show('owner');
    await waitFor(() => expect(api.apiCallMinutes).toHaveBeenCalledOnce());
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('closes for the rest of the page', async () => {
    act(() => noteCallSessionMinutes({ owner: ownerOf('owner'), low: true }, CALLER));
    show('owner');
    fireEvent.click(await screen.findByRole('button', { name: 'Dismiss' }));
    expect(callMinutes().low).toBe(false);
  });

  it('tells an owner already on Pro when the minutes start again, with no offer', async () => {
    show('owner-pro', reading('owner-pro', { used: 4950, limit: 5_000, low: true }));
    expect(
      await screen.findByText(`50 call minutes left this month. They start again on ${FIRST}.`),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'See Pro' })).toBeNull();
  });

  it('offers a team admin what Pro for Teams has', async () => {
    show('admin');
    expect(
      await screen.findByText('80 call minutes left this month. Pro for Teams has 2,500 a member.'),
    ).toBeTruthy();
  });

  it.each(['member', 'collaborator', 'guest'] as const)(
    'shows a %s nothing, and reads nothing for them',
    async (who) => {
      const { container } = show(who);
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 30));
      });
      expect(container.textContent).toBe('');
      expect(api.apiCallMinutes).not.toHaveBeenCalled();
    },
  );

  it('shows nothing once the month is no longer low, or when the api gives no numbers', async () => {
    const { container, unmount } = show('owner', reading('owner', { used: 100 }));
    await waitFor(() => expect(api.apiCallMinutes).toHaveBeenCalled());
    expect(container.textContent).toBe('');
    unmount();
    const none = show('owner', { metered: false });
    await waitFor(() => expect(api.apiCallMinutes).toHaveBeenCalledTimes(2));
    expect(none.container.textContent).toBe('');
    none.unmount();
    api.apiCallMinutes.mockRejectedValue(new Error('offline'));
    const failed = render(
      withPro(
        <CallMinutesLow owner={ownerOf('owner')} caller={CALLER} />,
        proService('owner').fetcher,
      ),
    );
    await waitFor(() => expect(api.apiCallMinutes).toHaveBeenCalledTimes(3));
    expect(failed.container.textContent).toBe('');
  });
});

describe('Call Minutes in Collaborators', () => {
  function show(who: Who, read: CallMinutesResponse = reading(who), usage = {}) {
    api.apiCallMinutes.mockResolvedValue(read);
    const service = proService(who, usage);
    return {
      ...service,
      ...render(withPro(<CallMinutesSection caller={CALLER} />, service.fetcher, who)),
    };
  }

  it('shows the owner the month, when it resets and what Pro has', async () => {
    show('owner');
    expect(await screen.findByRole('heading', { name: 'Call Minutes' })).toBeTruthy();
    expect(
      screen.getByText(
        'Counted while two or more people are in a call: each of them, every minute. Being here alone counts nothing.',
      ),
    ).toBeTruthy();
    expect(screen.getByText('240')).toBeTruthy();
    expect(screen.getByText('of 1,000 used')).toBeTruthy();
    const meter = screen.getByRole('meter', { name: 'Call Minutes' });
    expect(meter.getAttribute('aria-valuenow')).toBe('240');
    expect(meter.getAttribute('aria-valuetext')).toBe('240 of 1,000 used');
    expect(screen.getByText(`Resets on ${FIRST}. Pro has 5,000.`)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'See Pro' })).toBeTruthy();
  });

  it('counts what the owner’s other Spaces spent since this one last did', async () => {
    show('owner', reading('owner', { used: null }), { callMinutes: { used: 612 } });
    expect(await screen.findByText('612')).toBeTruthy();
  });

  it('shows an owner on Pro their month with the badge and no offer', async () => {
    show('owner-pro', reading('owner-pro', { limit: 5_000 }));
    expect(await screen.findByText('of 5,000 used')).toBeTruthy();
    expect(screen.getByText(`Resets on ${FIRST}.`)).toBeTruthy();
    expect(screen.getByRole('img', { name: 'You Have Pro' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /See Pro|Ask an Admin/ })).toBeNull();
  });

  it('shows an owner just upgraded the new limit while the api still answers the old one', async () => {
    show('owner-pro', reading('owner-pro', { used: 5, limit: 5 }));
    expect(await screen.findByText('of 5,000 used')).toBeTruthy();
    expect(screen.getByRole('meter', { name: 'Call Minutes' }).getAttribute('aria-valuetext')).toBe(
      '5 of 5,000 used',
    );
  });

  it('points a team’s member at an admin', async () => {
    show('member');
    expect(await screen.findByRole('button', { name: 'Ask an Admin' })).toBeTruthy();
    expect(screen.getByText(`Resets on ${FIRST}.`)).toBeTruthy();
  });

  it.each(['collaborator', 'guest'] as const)('shows a %s no section at all', async (who) => {
    const { container } = show(who, reading(who, { used: null, limit: null }));
    await waitFor(() => expect(api.apiCallMinutes).toHaveBeenCalled());
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30));
    });
    expect(container.textContent).toBe('');
  });

  it('draws nothing where calls are not metered, the read fails, or there is no Space to ask about', async () => {
    const { container, unmount } = show('owner', { metered: false });
    await waitFor(() => expect(api.apiCallMinutes).toHaveBeenCalled());
    expect(container.textContent).toBe('');
    unmount();
    api.apiCallMinutes.mockRejectedValue(new Error('offline'));
    const failed = render(
      withPro(<CallMinutesSection caller={CALLER} />, proService('owner').fetcher),
    );
    await waitFor(() => expect(api.apiCallMinutes).toHaveBeenCalledTimes(2));
    expect(failed.container.textContent).toBe('');
    failed.unmount();
    render(withPro(<CallMinutesSection caller={null} />, proService('owner').fetcher));
    expect(api.apiCallMinutes).toHaveBeenCalledTimes(2);
  });
});

describe('the Call dock', () => {
  const actions = {
    join: vi.fn(),
    toggleMute: vi.fn(),
    toggleCamera: vi.fn(),
    toggleScreen: vi.fn(),
    raiseHand: vi.fn(),
    lowerHand: vi.fn(),
  };
  const inMode = () =>
    act(() => {
      setCallActions(actions);
      setCallSelf({ available: true, canSpeak: true });
    });
  const USED = { owner: ownerOf('owner'), guest: false, used: 1000, limit: 1000 };

  it('reads Calls Paused while the minutes are used, and a press says why', async () => {
    inMode();
    render(
      withPro(
        <>
          <CallMinutesHost />
          <CallStripGroup />
        </>,
        proService('owner').fetcher,
      ),
    );
    expect(screen.getByRole('button', { name: 'Connecting audio' })).toBeTruthy();
    // A join refused on arriving: the dock pauses, and nothing opens by itself.
    act(() => noteCallMinutesUsed(USED, false, CALLER));
    const paused = screen.getByRole('button', { name: 'Calls Paused' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByText('Calls are paused')).toBeTruthy();
    fireEvent.click(paused);
    expect(
      await screen.findByRole('heading', { name: 'This Month’s Call Minutes Are Used' }),
    ).toBeTruthy();
    // The press also asks to join once more: the api admits it as soon as the month is no longer used.
    expect(actions.join).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Back to the Space' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    // Calls start again: the dock is the call's again.
    act(() => receiveCallMinutes('system', { kind: 'call-minutes', state: 'ok' }, false));
    expect(screen.queryByRole('button', { name: 'Calls Paused' })).toBeNull();
  });

  it('opens the dialog by itself for a call that was running', async () => {
    inMode();
    render(withPro(<CallMinutesHost />, proService('guest').fetcher, 'guest'));
    act(() =>
      receiveCallMinutes(
        'system',
        { kind: 'call-minutes', state: 'used', ...USED, owner: ownerOf('guest') },
        true,
      ),
    );
    expect(await screen.findByRole('heading', { name: 'Calls Are Paused' })).toBeTruthy();
  });

  it('hangs the low notice over the dock for the owner', async () => {
    api.apiCallMinutes.mockResolvedValue(reading('owner', { used: 930, low: true }));
    render(withPro(<CallMinutesHost />, proService('owner').fetcher));
    act(() => noteCallSessionMinutes({ owner: ownerOf('owner'), low: true }, CALLER));
    expect(await screen.findByText('70 call minutes left this month. Pro has 5,000.')).toBeTruthy();
    expect(document.querySelector('[data-call-minutes-low]')).toBeTruthy();
  });

  it('draws and asks nothing with Pro off, whatever the store was told', async () => {
    setProForTests(false);
    inMode();
    const service = proService('owner');
    const { container } = render(
      withPro(
        <>
          <CallMinutesHost />
          <CallMinutesSection caller={CALLER} />
        </>,
        service.fetcher,
      ),
    );
    act(() => {
      noteCallSessionMinutes({ owner: ownerOf('owner'), low: true }, CALLER);
      noteCallMinutesUsed(USED, true, CALLER);
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30));
    });
    expect(container.textContent).toBe('');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(api.apiCallMinutes).not.toHaveBeenCalled();
    expect(service.calls).toEqual([]);
  });
});
