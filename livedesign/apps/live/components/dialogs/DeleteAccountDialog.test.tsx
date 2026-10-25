// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// docs/specs/014-identity/auth-and-guest-access.md "Deleting an account": identity is confirmed before anything is
// deleted, so a cancelled reverification leaves the account and its data as they were.
const calls: string[] = [];
const auth = vi.hoisted(() => ({ confirmed: true }));
const server = vi.hoisted(() => ({ result: { deleted: {} } as unknown }));
vi.mock('@/components/providers/deferred-auth', () => ({
  useDeferredAuth: () => ({
    user: { email: 'a@example.com' },
    confirmIdentity: async () => {
      calls.push('confirm');
      return auth.confirmed;
    },
    deleteAccount: async () => void calls.push('session'),
  }),
}));
vi.mock('@/lib/api-client', () => ({
  apiDeleteAccount: async () => {
    calls.push('server');
    return server.result;
  },
}));
vi.mock('@/lib/telemetry', () => ({ track: () => {} }));

import { DeleteAccountDialog } from './DeleteAccountDialog';

afterEach(() => {
  cleanup();
  calls.length = 0;
});

function confirmDelete() {
  const onDeleted = vi.fn();
  render(<DeleteAccountDialog open onClose={() => {}} onDeleted={onDeleted} />);
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'a@example.com' } });
  fireEvent.click(screen.getByRole('button', { name: 'Delete Account' }));
  return onDeleted;
}

describe('DeleteAccountDialog', () => {
  it('deletes nothing when identity is not confirmed', async () => {
    auth.confirmed = false;
    const onDeleted = confirmDelete();
    await screen.findByText(/nothing was deleted/);
    expect(calls).toEqual(['confirm']);
    expect(onDeleted).not.toHaveBeenCalled();
  });

  it('confirms identity, then deletes the server data, then the account', async () => {
    auth.confirmed = true;
    const onDeleted = confirmDelete();
    await waitFor(() => expect(onDeleted).toHaveBeenCalled());
    expect(calls).toEqual(['confirm', 'server', 'session']);
  });

  it('keeps the session and says so when the data went but the account did not close', async () => {
    auth.confirmed = true;
    server.result = 'account_not_closed';
    const onDeleted = confirmDelete();
    await screen.findByText(/closing your liveworkspace account failed/);
    expect(calls).toEqual(['confirm', 'server']);
    expect(onDeleted).not.toHaveBeenCalled();
    server.result = { deleted: {} };
  });
});
