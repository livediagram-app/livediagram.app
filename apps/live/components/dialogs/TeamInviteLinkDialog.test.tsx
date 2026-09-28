// @vitest-environment jsdom

// "Invite by link" (docs/specs/013-workspace/teams.md): each open starts clean, so a reopened dialog
// never shows the previous session's "Copied" or error.

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TeamInviteLink } from '@livediagram/api-schema';
import { TeamInviteLinkDialog } from './TeamInviteLinkDialog';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
const generate = vi.fn();
vi.mock('@/lib/api-client', () => ({
  apiGenerateTeamInviteLink: (...args: unknown[]) => generate(...args),
  apiRevokeTeamInviteLink: vi.fn(),
}));

const DAY = 86_400_000;
const link = (): TeamInviteLink =>
  ({ token: 'tok', expiresAt: Date.now() + 3 * DAY }) as TeamInviteLink;

type Props = Parameters<typeof TeamInviteLinkDialog>[0];
const props = (over: Partial<Props> = {}): Props => ({
  open: true,
  onClose: vi.fn(),
  ownerId: 'me',
  teamId: 't1',
  inviteLink: link(),
  onInviteLinkChange: vi.fn(),
  ...over,
});

beforeEach(() => {
  Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
});
afterEach(() => {
  cleanup();
  generate.mockReset();
});

describe('TeamInviteLinkDialog', () => {
  it('labels the expiry in days', () => {
    render(<TeamInviteLinkDialog {...props()} />);
    expect(screen.getByText('Expires in 3 days')).toBeTruthy();
  });

  it('drops the previous session copied label on reopen', async () => {
    const p = props();
    const { rerender } = render(<TeamInviteLinkDialog {...p} />);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Copy link' })));
    expect(screen.getByRole('button', { name: 'Copied' })).toBeTruthy();
    rerender(<TeamInviteLinkDialog {...p} open={false} />);
    rerender(<TeamInviteLinkDialog {...p} />);
    expect(screen.getByRole('button', { name: 'Copy link' })).toBeTruthy();
  });

  it('drops the previous session error on reopen', async () => {
    generate.mockRejectedValue(new Error('boom'));
    const p = props({ inviteLink: null });
    const { rerender } = render(<TeamInviteLinkDialog {...p} />);
    await act(async () =>
      fireEvent.click(screen.getByRole('button', { name: /turn on invite link/i })),
    );
    expect(screen.getByText(/could not create the link/i)).toBeTruthy();
    rerender(<TeamInviteLinkDialog {...p} open={false} />);
    rerender(<TeamInviteLinkDialog {...p} />);
    expect(screen.queryByText(/could not create the link/i)).toBeNull();
  });
});
