// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeAll, describe, expect, it } from 'vitest';
import { preloadUpgradeDialog } from '../provider/SubscriptionProvider';
import { useSubscription, useUpgrade } from '../provider/hooks';
import {
  ASKED_AT,
  GARDEN,
  meResponse,
  serviceFetch,
  team,
  withProvider,
  type Service,
} from '../test/fixture';

// subscription.md "Ask an Admin": a team's member sends its admins a request for Pro for Teams, with the limit that
// prompted it and a note, once a day; Copy Note stays for sending it another way.

beforeAll(async () => {
  await preloadUpgradeDialog();
}, 60_000);

function Opener() {
  const upgrade = useUpgrade();
  const load = useSubscription();
  const asked = load.status === 'ready' ? (load.me.teams[0]?.askedAt ?? 'never') : load.status;
  return (
    <>
      <button
        type="button"
        onClick={() => upgrade.openAskAdmin({ owner: GARDEN, limit: 'automationRules' })}
      >
        Open
      </button>
      <output data-testid="asked">{asked}</output>
    </>
  );
}

async function open(service: Service = {}) {
  const fake = serviceFetch({
    me: meResponse({ teams: [team(GARDEN, 'Garden Club', 'member')] }),
    ...service,
  });
  render(withProvider(<Opener />, fake.fetcher));
  await waitFor(() => expect(screen.getByTestId('asked').textContent).not.toBe('loading'));
  fireEvent.click(screen.getByRole('button', { name: 'Open' }));
  const dialog = await screen.findByRole('dialog', { name: 'Ask an Admin About Pro' });
  return { dialog, calls: fake.calls };
}

describe('Ask an Admin', () => {
  it('sends the request with the limit and the note, and says where it went', async () => {
    const { dialog, calls } = await open();
    expect(dialog.textContent).toContain('Goes to the admins of Garden Club');
    fireEvent.change(screen.getByLabelText('Your Note'), { target: { value: '  Please?  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send Request' }));
    await screen.findByText(
      'Sent. The admins of Garden Club see it in Settings, under Subscription.',
    );
    expect(calls.find((call) => call.path === '/team-request')).toMatchObject({
      method: 'POST',
      auth: 'Bearer tok',
      body: { owner: GARDEN, limit: 'automationRules', note: 'Please?' },
    });
    // The page's own read now knows they asked, without reading it all again.
    await waitFor(() => expect(screen.getByTestId('asked').textContent).toBe(String(ASKED_AT)));
    expect(screen.queryByRole('button', { name: 'Send Request' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Done' })).toBeTruthy();
    // Copy Note is still there, as the second way.
    expect(screen.getByRole('button', { name: 'Copy Note' })).toBeTruthy();
  });

  it('says plainly when they already asked today', async () => {
    await open({ teamRequest: { sent: false, askedAt: ASKED_AT } });
    fireEvent.click(screen.getByRole('button', { name: 'Send Request' }));
    await screen.findByText('You asked on 21 November. The admins of Garden Club still have it.');
  });

  it('opens saying so when the service already said they asked', async () => {
    await open({
      me: meResponse({
        teams: [team(GARDEN, 'Garden Club', 'member', 'free', { askedAt: ASKED_AT })],
      }),
    });
    expect(screen.getByText(/You asked on 21 November/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Send Request' })).toBeNull();
  });

  it("says what the service refused, in the person's words", async () => {
    for (const [error, words] of [
      ['already_subscribed', 'This team already has Pro for Teams.'],
      ['not_team_member', 'Only a member of this team can ask its admins.'],
      ['teapot', 'Couldn’t send it. Check your connection and try again.'],
    ] as const) {
      await open({ refuse: { status: 409, error } });
      fireEvent.click(screen.getByRole('button', { name: 'Send Request' }));
      await screen.findByText(words);
      // Still there to try again.
      expect(screen.getByRole('button', { name: 'Send Request' })).toBeTruthy();
      cleanup();
    }
  });
});
