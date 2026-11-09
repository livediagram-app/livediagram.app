// Invite by Link's focus (liveworkspace/docs/specs/004-index/one-explorer.md "Teams are run in the Explorer"): the
// keyboard follows a press here that turns the link on or off, and only that.
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { InviteLink, TeamResult } from '../data/teams';
import { InviteLinkDialog } from './InviteLinkDialog';

const LINK: InviteLink = { url: 'https://liveworkspace.app/join?token=abc', expiresAt: 0 };
const failed = async (): Promise<TeamResult<unknown>> => ({ ok: false, error: 'network' });
const done = async (): Promise<TeamResult<unknown>> => ({ ok: true, value: null });

function dialog(link: InviteLink | null, onReset = done, onClear = done) {
  const props = { teamName: 'Design', onReset, onClear, onClose: vi.fn() };
  const view = render(<InviteLinkDialog {...props} link={link} />);
  return (next: InviteLink | null) => view.rerender(<InviteLinkDialog {...props} link={next} />);
}

describe('InviteLinkDialog', () => {
  it('moves the keyboard to Copy when its own Turn On Link turns the link on', async () => {
    const show = dialog(null);
    fireEvent.click(screen.getByRole('button', { name: 'Turn On Link' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Turn On Link' })).toBeTruthy());
    show(LINK);
    await waitFor(() => expect(document.activeElement?.textContent).toBe('Copy'));
  });

  it('leaves the keyboard alone when a failed Turn On Link is followed by a change from elsewhere', async () => {
    const show = dialog(null, failed);
    fireEvent.click(screen.getByRole('button', { name: 'Turn On Link' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    const outside = document.createElement('button');
    document.body.append(outside);
    outside.focus();
    // Another admin turns it on: the dialog shows it without taking the keyboard.
    show(LINK);
    await screen.findByRole('button', { name: 'Copy' });
    expect(document.activeElement).toBe(outside);
    outside.remove();
  });

  it('leaves the keyboard alone after New Link when the link is later turned off elsewhere', async () => {
    const show = dialog(LINK);
    fireEvent.click(screen.getByRole('button', { name: 'New Link' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'New Link' })).toBeTruthy());
    const outside = document.createElement('button');
    document.body.append(outside);
    outside.focus();
    show(null);
    await screen.findByRole('button', { name: 'Turn On Link' });
    expect(document.activeElement).toBe(outside);
    outside.remove();
  });
});
