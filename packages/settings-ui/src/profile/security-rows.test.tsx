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
