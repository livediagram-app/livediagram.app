// @vitest-environment jsdom

// The invite email's Decline landing (docs/specs/013-workspace/teams.md "Declining from the email"): opening
// the page only reads; the button is what declines, and every answer has its own card.

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TeamInviteDecline } from './TeamInviteDecline';

const track = vi.hoisted(() => vi.fn());
vi.mock('@/lib/telemetry', () => ({ track }));
const read = vi.hoisted(() => vi.fn());
const decline = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api-client', () => ({
  apiReadTeamInviteDecline: read,
  apiDeclineTeamInvite: decline,
}));

const visit = (search: string) => window.history.replaceState(null, '', `/join/decline${search}`);

async function open(search: string) {
  visit(search);
  render(<TeamInviteDecline />);
  await act(async () => {});
}

afterEach(() => {
  cleanup();
  read.mockReset();
  decline.mockReset();
  track.mockReset();
});

describe('TeamInviteDecline', () => {
  it('reads the invite named by the token and asks first, declining nothing on open', async () => {
    read.mockResolvedValue({ teamName: 'Platform', status: 'invited' });
    await open('?token=abc');
    expect(read).toHaveBeenCalledWith('abc');
    expect(decline).not.toHaveBeenCalled();
    expect(screen.getByText('Decline the Invite to Platform?')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Accept Instead' }).getAttribute('href')).toBe(
      '/explorer/invites',
    );
  });

  it('declines on the button, counts it once, and shows the answer', async () => {
    read.mockResolvedValue({ teamName: 'Platform', status: 'invited' });
    decline.mockResolvedValue({ teamName: 'Platform', status: 'declined' });
    await open('?token=abc');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Decline Invite' }));
    });
    expect(decline).toHaveBeenCalledWith('abc');
    expect(track).toHaveBeenCalledWith('Team', 'Declined', 'Email');
    expect(screen.getByText('Invite Declined')).toBeTruthy();
  });

  it('keeps the question up with a retry message when the decline fails', async () => {
    read.mockResolvedValue({ teamName: 'Platform', status: 'invited' });
    decline.mockRejectedValue(new Error('offline'));
    await open('?token=abc');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Decline Invite' }));
    });
    expect(screen.getByRole('alert').textContent).toMatch(/Try again/);
    expect(screen.getByRole('button', { name: 'Decline Invite' })).toBeTruthy();
    expect(track).not.toHaveBeenCalled();
  });

  it('says an already declined invite is declined, with no button', async () => {
    read.mockResolvedValue({ teamName: 'Platform', status: 'declined' });
    await open('?token=abc');
    expect(screen.getByText('Invite Declined')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('says an expired invite has expired', async () => {
    read.mockResolvedValue({ teamName: 'Platform', status: 'expired' });
    await open('?token=abc');
    expect(screen.getByText('This Invite Has Expired')).toBeTruthy();
  });

  it('cannot undo a membership', async () => {
    read.mockResolvedValue({ teamName: 'Platform', status: 'joined' });
    await open('?token=abc');
    expect(screen.getByText("You're Already in Platform")).toBeTruthy();
  });

  it('handles the decline losing a race to an accept', async () => {
    read.mockResolvedValue({ teamName: 'Platform', status: 'invited' });
    decline.mockResolvedValue('already_joined');
    await open('?token=abc');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Decline Invite' }));
    });
    expect(screen.getByText("You're Already in the team")).toBeTruthy();
    expect(track).not.toHaveBeenCalled();
  });

  it('calls a link without a token invalid, without asking', async () => {
    await open('');
    expect(screen.getByText(/isn.t valid/i)).toBeTruthy();
    expect(read).not.toHaveBeenCalled();
  });

  it('calls a token the api does not know invalid', async () => {
    read.mockResolvedValue(null);
    await open('?token=nope');
    expect(screen.getByText(/isn.t valid/i)).toBeTruthy();
  });

  it('calls a failed read invalid', async () => {
    read.mockRejectedValue(new Error('offline'));
    await open('?token=abc');
    expect(screen.getByText(/isn.t valid/i)).toBeTruthy();
  });
});
