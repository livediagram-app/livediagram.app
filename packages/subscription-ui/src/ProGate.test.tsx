// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ProGate } from './ProGate';
import { GARDEN, ME, ownerView } from './test/fixture';

// subscription.md "What people see": a feature a tier does not include says so in its own place, with the same
// action rules as a limit.

const GATE = {
  title: 'Send Webhooks with Pro',
  description: 'Post a card’s changes to your own services the moment they happen, from any rule.',
  points: ['A Send Webhook step in any rule', 'Every delivery logged in the Audit Trail'],
  footnote: 'Everything else in Automations stays on Free.',
};

describe('ProGate', () => {
  it('the owner: the feature, what it includes, Upgrade to Pro and See What’s in Pro', () => {
    render(<ProGate {...GATE} owner={ownerView(ME, 'upgrade')} art={<span>art</span>} />);
    expect(screen.getByRole('heading', { level: 2, name: GATE.title })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Part of Pro' })).toBeTruthy();
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual(GATE.points);
    expect(screen.getByRole('button', { name: 'Upgrade to Pro' })).toBeTruthy();
    const more = screen.getByRole('link', { name: 'See What’s in Pro' });
    expect(more.getAttribute('href')).toMatch(/\/pricing$/);
    expect(screen.getByText(GATE.footnote)).toBeTruthy();
    // The picture is decoration.
    expect(screen.getByText('art').closest('[aria-hidden]')).not.toBeNull();
  });

  it('a team admin: Upgrade Team', () => {
    render(<ProGate {...GATE} owner={ownerView(GARDEN, 'upgrade')} />);
    expect(screen.getByRole('button', { name: 'Upgrade Team' })).toBeTruthy();
  });

  it('a team member: Ask an Admin, and who can upgrade', () => {
    render(<ProGate {...GATE} owner={ownerView(GARDEN, 'ask_admin')} />);
    expect(screen.getByRole('button', { name: 'Ask an Admin' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Upgrade/ })).toBeNull();
    expect(screen.getByText('Only a team admin can move this team to Pro for Teams.')).toBeTruthy();
  });

  it('inside a panel: no padding of its own, smaller words and buttons, the same parts', () => {
    const { container } = render(
      <ProGate {...GATE} owner={ownerView(ME, 'upgrade')} art={<span>art</span>} density="panel" />,
    );
    const gate = container.querySelector('[data-pro-gate]')!;
    expect(gate.className).not.toMatch(/\bp[xy]-/);
    expect(screen.getByRole('heading', { level: 2, name: GATE.title }).className).toContain(
      'text-lg',
    );
    expect(screen.getByRole('button', { name: 'Upgrade to Pro' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'See What’s in Pro' })).toBeTruthy();
    expect(screen.getAllByRole('listitem')).toHaveLength(GATE.points.length);
  });

  it('an owner who already pays: it turns on within a minute, never that theirs does not include it', () => {
    // The item's app asks the service again within a minute of a subscription starting (and falls back to Free
    // while it cannot ask): the gate is still up, and the person it is shown to is the one paying.
    const { container } = render(<ProGate {...GATE} owner={ownerView(ME, 'manage', 'pro')} />);
    expect(
      screen.getByText('Your subscription includes this. It turns on within a minute.'),
    ).toBeTruthy();
    expect(screen.queryByText(/does not include this/)).toBeNull();
    expect(container.querySelector('[data-pro-gate]')!.getAttribute('data-pro-gate')).toBe(
      'manage',
    );
    // Nothing to buy, and nobody to ask.
    expect(container.querySelector('button')).toBeNull();
    expect(container.querySelector('a')).toBeNull();
  });

  it('anyone else: no offer at all', () => {
    const { container } = render(<ProGate {...GATE} owner={ownerView(ME, 'none')} heading="h1" />);
    expect(screen.getByRole('heading', { level: 1, name: GATE.title })).toBeTruthy();
    expect(container.querySelector('button')).toBeNull();
    expect(container.querySelector('a')).toBeNull();
    expect(container.querySelector('[data-pro-gate]')!.getAttribute('data-pro-gate')).toBe('none');
    expect(
      screen.getByText(
        'This item’s owner decides its subscription, and theirs does not include this.',
      ),
    ).toBeTruthy();
  });

  it('names the item in its app’s own word when given one', () => {
    render(<ProGate {...GATE} owner={ownerView(ME, 'none')} noun="plan" />);
    expect(
      screen.getByText(
        'This plan’s owner decides its subscription, and theirs does not include this.',
      ),
    ).toBeTruthy();
  });
});
