// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SessionsRows, SignInMethodsRows, type AccountSecurity } from './SecurityRows';

// A read that fails once, then answers: a refused load offers Try again, which reads again.
function flaky<T>(answer: T) {
  let calls = 0;
  return vi.fn(async () => (calls++ === 0 ? null : answer));
}

function security(overrides: Partial<AccountSecurity>): AccountSecurity {
  return {
    sessions: vi.fn(async () => []),
    revokeSession: vi.fn(async () => true),
    revokeOtherSessions: vi.fn(async () => true),
    signInMethods: vi.fn(async () => ({ google: 'available' as const })),
    connectGoogle: vi.fn(async () => true),
    ...overrides,
  };
}

describe('Sign-in and Security load errors', () => {
  it('Where You’re Signed In offers Try again when the sessions can’t be read', async () => {
    const sessions = flaky([
      {
        id: 'mine',
        token: 't',
        current: true,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0) Edg/120.0',
        createdAt: '2026-10-20T10:00:00Z',
        updatedAt: '2026-10-24T10:00:00Z',
      },
    ]);
    render(<SessionsRows security={security({ sessions })} />);
    expect(await screen.findByText(/Couldn’t load your sessions/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Edge on Windows')).toBeTruthy();
    expect(sessions).toHaveBeenCalledTimes(2);
  });

  it('Sign-in Methods offers Try again when the methods can’t be read', async () => {
    const signInMethods = flaky({ google: 'available' as const });
    render(<SignInMethodsRows security={security({ signInMethods })} />);
    expect(await screen.findByRole('alert')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
    expect((screen.getByRole('button', { name: 'Connect' }) as HTMLButtonElement).disabled).toBe(
      false,
    );
    expect(signInMethods).toHaveBeenCalledTimes(2);
  });
});

describe('Where You’re Signed In by keyboard', () => {
  const session = (id: string, current: boolean, ua: string) => ({
    id,
    token: `t-${id}`,
    current,
    userAgent: ua,
    createdAt: '2026-10-20T10:00:00Z',
    updatedAt: '2026-10-24T10:00:00Z',
  });
  const all = [
    session('mine', true, 'Mozilla/5.0 (Macintosh) Chrome/120.0 Safari/537.36'),
    session('a', false, 'Mozilla/5.0 (Windows NT 10.0) Edg/120.0'),
    session('b', false, 'Mozilla/5.0 (X11; Linux x86_64) Firefox/120.0'),
  ];

  it('keeps focus in the dialog as a signed-out session’s row goes', async () => {
    let left = all;
    const sessions = vi.fn(async () => left);
    const revokeSession = vi.fn(async (token: string) => {
      left = left.filter((s) => s.token !== token);
      return true;
    });
    const revokeOtherSessions = vi.fn(async () => {
      left = left.filter((s) => s.current);
      return true;
    });
    render(
      <div role="dialog" tabIndex={-1} aria-label="Settings">
        <SessionsRows security={security({ sessions, revokeSession, revokeOtherSessions })} />
      </div>,
    );
    const first = await screen.findByRole('button', { name: 'Sign out of Edge on Windows' });
    first.focus();
    fireEvent.click(first);
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Sign out of Edge on Windows' })).toBeNull(),
    );
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole('button', { name: 'Sign out of Firefox on Linux' }),
      ),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Sign Out Others' }));
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /Sign Out Others/ })).toBeNull(),
    );
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('dialog')));
  });
});
