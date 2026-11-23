// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeAll, describe, expect, it } from 'vitest';
import { TIER_LIMITS } from '@liveworkspace/subscription';
import { LimitNotice } from './LimitNotice';
import { ASK_ADMIN_SENTENCE } from './limit-copy';
import { preloadUpgradeDialog } from './provider/SubscriptionProvider';
import { useOwnerView } from './provider/hooks';
import {
  GARDEN,
  ME,
  meResponse,
  ownerView,
  serviceFetch,
  team,
  withProvider,
} from './test/fixture';

// subscription.md "Who pays for an item": only the owner (or a team's admin) is offered an upgrade; a team's member
// sees Ask an Admin; anyone else is told the limit was reached and nothing more.

const LIMIT = TIER_LIMITS.free.automationRunsPerMonth;

beforeAll(async () => {
  await preloadUpgradeDialog();
}, 60_000);

describe('LimitNotice', () => {
  it('the owner: what happened, what Pro gives, and Upgrade to Pro', () => {
    render(
      <LimitNotice
        limitKey="automationRunsPerMonth"
        used={LIMIT}
        owner={ownerView(ME, 'upgrade')}
      />,
    );
    const notice = screen.getByRole('status');
    expect(notice.getAttribute('data-callout')).toBe('warning');
    expect(notice.textContent).toContain(`this month’s limit of ${LIMIT} is reached`);
    expect(notice.textContent).toContain('Pro gives you 10,000 a month.');
    expect(screen.getByRole('button', { name: 'Upgrade to Pro' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Ask an Admin' })).toBeNull();
  });

  it('a team admin: Upgrade Team, and what Pro for Teams gives the team', () => {
    render(
      <LimitNotice
        limitKey="automationRunsPerMonth"
        used={LIMIT}
        owner={ownerView(GARDEN, 'upgrade')}
      />,
    );
    expect(screen.getByRole('status').textContent).toContain(
      'Pro for Teams gives the team 5,000 a member.',
    );
    expect(screen.getByRole('button', { name: 'Upgrade Team' })).toBeTruthy();
  });

  it('a team member: Ask an Admin, and no price or offer of their own', () => {
    render(
      <LimitNotice
        limitKey="automationRunsPerMonth"
        used={LIMIT}
        owner={ownerView(GARDEN, 'ask_admin')}
      />,
    );
    expect(screen.getByRole('status').textContent).toContain(ASK_ADMIN_SENTENCE);
    expect(screen.getByRole('button', { name: 'Ask an Admin' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Upgrade/ })).toBeNull();
  });

  it('anyone else: the limit was reached, and nothing more', () => {
    render(
      <LimitNotice limitKey="automationRunsPerMonth" used={LIMIT} owner={ownerView(ME, 'none')} />,
    );
    const notice = screen.getByRole('status');
    expect(notice.textContent).toContain('is reached');
    expect(notice.textContent).not.toContain('Pro');
    expect(notice.querySelector('button')).toBeNull();
  });

  it('an owner already on Pro gets the amber line without an offer', () => {
    render(
      <LimitNotice
        limitKey="automationRunsPerMonth"
        used={TIER_LIMITS.pro.automationRunsPerMonth}
        owner={ownerView(ME, 'manage', 'pro')}
      />,
    );
    const notice = screen.getByRole('status');
    expect(notice.textContent).toContain('this month’s limit of 10,000 is reached');
    expect(notice.querySelector('button')).toBeNull();
  });

  it('takes a title and a way on beside the offer, which then steps back to See Pro', () => {
    render(
      <LimitNotice
        limitKey="imageMaxBytes"
        used={7_200_000}
        limit={5_000_000}
        owner={ownerView(ME, 'upgrade')}
        title="This Image Is Over 5 MB"
        sentence="Free takes images up to 5 MB."
        offer="Pro takes 25 MB."
        primaryAction={<button type="button">Choose Another</button>}
      />,
    );
    const notice = screen.getByRole('status');
    expect(notice.textContent).toContain('This Image Is Over 5 MB');
    expect(notice.textContent).toContain('Free takes images up to 5 MB. Pro takes 25 MB.');
    const buttons = screen.getAllByRole('button').map((b) => b.textContent);
    expect(buttons).toEqual(['Choose Another', 'See Pro']);
  });

  it('draws a second way on after Upgrade, and both ways on for someone with no offer', () => {
    const manage = <button type="button">Manage Images</button>;
    const { unmount } = render(
      <LimitNotice
        limitKey="imageStorageBytes"
        used={500_000_000}
        limit={500_000_000}
        owner={ownerView(ME, 'upgrade')}
        title="Image Storage Is Full"
        sentence="Your images are all safe."
        secondaryAction={manage}
      />,
    );
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual([
      'Upgrade to Pro',
      'Manage Images',
    ]);
    unmount();
    render(
      <LimitNotice
        limitKey="imageStorageBytes"
        used={500_000_000}
        limit={500_000_000}
        owner={ownerView(ME, 'none')}
        secondaryAction={manage}
        primaryAction={<button type="button">Choose Another</button>}
      />,
    );
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual([
      'Choose Another',
      'Manage Images',
    ]);
  });

  it('takes the app’s own sentences', () => {
    render(
      <LimitNotice
        limitKey="automationRunsPerMonth"
        used={LIMIT}
        owner={ownerView(ME, 'upgrade')}
        sentence="Daily limit reached: rules run again tomorrow."
        offer="Pro runs 10,000 a month."
      />,
    );
    expect(screen.getByRole('status').textContent).toContain(
      'Daily limit reached: rules run again tomorrow. Pro runs 10,000 a month.',
    );
  });

  it('is nothing under the limit, and while the owner is not known', () => {
    const { container, rerender } = render(
      <LimitNotice limitKey="automationRunsPerMonth" used={60} owner={ownerView(ME, 'upgrade')} />,
    );
    expect(container.innerHTML).toBe('');
    rerender(
      <LimitNotice limitKey="automationRunsPerMonth" used={LIMIT} owner={{ status: 'loading' }} />,
    );
    expect(container.innerHTML).toBe('');
    rerender(<LimitNotice limitKey="automationRunsPerMonth" used={LIMIT} owner={null} />);
    expect(container.innerHTML).toBe('');
  });

  it('with the server’s own limit and no owner view, says the limit and offers nothing', () => {
    render(
      <LimitNotice
        limitKey="automationRules"
        used={10}
        limit={10}
        owner={{ status: 'signed_out' }}
      />,
    );
    const notice = screen.getByRole('status');
    expect(notice.textContent).toContain('Automation Rules: the limit of 10 is reached.');
    expect(notice.querySelector('button')).toBeNull();
  });

  it('nudges from 80% once a day, only someone on Free who may upgrade', () => {
    const { unmount } = render(
      <LimitNotice limitKey="automationRunsPerMonth" used={405} owner={ownerView(ME, 'upgrade')} />,
    );
    const nudge = screen.getByRole('status');
    expect(nudge.getAttribute('data-callout')).toBe('info');
    expect(nudge.textContent).toContain('95 left this month.');
    expect(screen.getByRole('button', { name: 'See Pro' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByRole('status')).toBeNull();
    unmount();
    // Not again today, in this browser.
    render(
      <LimitNotice limitKey="automationRunsPerMonth" used={410} owner={ownerView(ME, 'upgrade')} />,
    );
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('never nudges a member, an outsider, or with `near` off', () => {
    const { container, rerender } = render(
      <LimitNotice
        limitKey="automationRunsPerMonth"
        used={405}
        owner={ownerView(GARDEN, 'ask_admin')}
      />,
    );
    expect(container.innerHTML).toBe('');
    rerender(
      <LimitNotice limitKey="automationRunsPerMonth" used={405} owner={ownerView(ME, 'none')} />,
    );
    expect(container.innerHTML).toBe('');
    rerender(
      <LimitNotice
        limitKey="automationRunsPerMonth"
        used={405}
        owner={ownerView(ME, 'upgrade')}
        near={false}
      />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('Upgrade opens the provider’s one dialog, set to the owner', async () => {
    const { fetcher } = serviceFetch({
      me: meResponse({ teams: [team(GARDEN, 'Garden Club', 'admin')] }),
      owners: { [GARDEN]: ownerView(GARDEN, 'upgrade') },
    });
    function Board() {
      const owner = useOwnerView(GARDEN);
      return <LimitNotice limitKey="automationRunsPerMonth" used={LIMIT} owner={owner} />;
    }
    render(withProvider(<Board />, fetcher));
    fireEvent.click(await screen.findByRole('button', { name: 'Upgrade Team' }));
    const dialog = await screen.findByRole('dialog');
    await waitFor(() =>
      expect(
        dialog.querySelector('[role="group"][aria-label="Subscribe For"] [aria-pressed="true"]')
          ?.textContent,
      ).toBe('A Team'),
    );
    expect(screen.getByRole('button', { name: 'Get Pro for Teams' })).toBeTruthy();
  });

  it('Ask an Admin opens the note, which names the team and the limit', async () => {
    const { fetcher } = serviceFetch({
      me: meResponse({ teams: [team(GARDEN, 'Garden Club', 'member')] }),
      owners: { [GARDEN]: ownerView(GARDEN, 'ask_admin') },
    });
    function Board() {
      const owner = useOwnerView(GARDEN);
      return <LimitNotice limitKey="automationRunsPerMonth" used={LIMIT} owner={owner} />;
    }
    render(withProvider(<Board />, fetcher));
    fireEvent.click(await screen.findByRole('button', { name: 'Ask an Admin' }));
    const dialog = await screen.findByRole('dialog', { name: 'Ask an Admin About Pro' });
    expect(dialog.textContent).toContain('Only an admin of Garden Club can subscribe the team.');
    expect((screen.getByLabelText('Your Note') as HTMLTextAreaElement).value).toContain(
      'Automation Runs',
    );
  });
});
