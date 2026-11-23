// @vitest-environment jsdom
// liveworkspace/docs/specs/019-subscription/subscription.md "A team's page in the Explorer": the team's plan on its
// card, and the one action whoever is looking may take.
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  GARDEN,
  meResponse,
  serviceFetch,
  setProForTests,
  team,
  type Service,
} from '@liveworkspace/subscription-ui/testing';
import { proOnForTests, withPro } from '@liveworkspace/subscription-ui/testing/who';
import { TeamPlan } from './TeamPlan';

proOnForTests();
afterEach(cleanup);

const TEAM_ID = GARDEN.slice(2);

function show(service: Service) {
  const { fetcher, calls } = serviceFetch(service);
  render(withPro(<TeamPlan teamId={TEAM_ID} />, fetcher));
  return calls;
}

const row = () => document.querySelector('[data-team-plan]');

describe('TeamPlan', () => {
  it('offers a Free team’s admin Upgrade Team, for this team', async () => {
    show({ me: meResponse({ teams: [team(GARDEN, 'Garden', 'admin')] }) });
    await screen.findByText('Free Plan');
    expect(screen.getByText('Pro for Teams raises the team’s limits.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Upgrade Team' }));
    // The upgrade dialog opens on A Team, this team chosen.
    expect(await screen.findByRole('dialog')).toBeTruthy();
    expect(row()?.getAttribute('data-team-plan')).toBe('free');
  });

  it('offers a Free team’s member Ask an Admin', async () => {
    show({ me: meResponse({ teams: [team(GARDEN, 'Garden', 'member')] }) });
    fireEvent.click(await screen.findByRole('button', { name: 'Ask an Admin' }));
    expect(await screen.findByRole('dialog')).toBeTruthy();
  });

  it('names a subscribed team’s tier and seats, with Manage Billing for its admin', async () => {
    const calls = show({ me: meResponse({ teams: [team(GARDEN, 'Garden', 'admin', 'team')] }) });
    await screen.findByText('Pro for Teams · 3 seats');
    expect(screen.queryByText('Pro for Teams raises the team’s limits.')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Manage Billing' }));
    await waitFor(() => expect(calls.some((c) => c.path === '/portal')).toBe(true));
  });

  it('says what the service refused when the portal will not open', async () => {
    show({
      me: meResponse({ teams: [team(GARDEN, 'Garden', 'admin', 'team', { seats: 1 })] }),
      refuse: { status: 500, error: 'portal_failed' },
    });
    await screen.findByText('Pro for Teams · 1 seat');
    fireEvent.click(screen.getByRole('button', { name: 'Manage Billing' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Manage Billing' })).toBeTruthy();
  });

  it('gives a subscribed team’s member the plan and no button', async () => {
    show({ me: meResponse({ teams: [team(GARDEN, 'Garden', 'member', 'team')] }) });
    await screen.findByText('Pro for Teams · 3 seats');
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('draws nothing for a team the service does not list, before it answers, or with Pro off', async () => {
    show({ me: meResponse({ teams: [] }) });
    await waitFor(() => expect(row()).toBeNull());
    cleanup();
    show({ down: true });
    expect(row()).toBeNull();
    cleanup();
    setProForTests(false);
    show({ me: meResponse({ teams: [team(GARDEN, 'Garden', 'admin')] }) });
    expect(row()).toBeNull();
  });
});
