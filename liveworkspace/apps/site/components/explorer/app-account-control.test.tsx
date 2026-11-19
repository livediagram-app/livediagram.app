// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { noteSignedOutHere } from '@liveworkspace/auth-client/signed-out-here';
import { AppAccountControl } from './AppAccountControl';

// The Explorer on an app's address after a sign-out of that app alone (its header's or Settings' Sign Out, which
// reloads the page): its account control says so, naming the app (liveworkspace/docs/specs/003-accounts/accounts.md
// "Signed out of this app only", Work Tracker 1283).

const page = vi.hoisted(() => ({ app: 'livediagram' as string | null }));
vi.mock('@/lib/explorer/page-app', async (original) => ({
  ...(await original<typeof import('@/lib/explorer/page-app')>()),
  pageApp: () => page.app,
}));
vi.mock('@/lib/explorer/app-session', async (original) => ({
  ...(await original<typeof import('@/lib/explorer/app-session')>()),
  appAccount: async () => null,
  onAppAccountChange: () => () => {},
}));

beforeEach(() => {
  sessionStorage.clear();
  page.app = 'livediagram';
});
afterEach(cleanup);

describe('AppAccountControl', () => {
  it('says the sign-out reached this app alone, naming it', async () => {
    noteSignedOutHere();
    render(<AppAccountControl />);
    expect(
      (await screen.findByText('Signed out of livediagram only')).closest('[role="status"]'),
    ).toBeTruthy();
  });

  it('says nothing after an ordinary visit', async () => {
    render(<AppAccountControl />);
    expect(await screen.findByRole('button', { name: 'Guest, account menu' })).toBeTruthy();
    expect(screen.queryByText(/^Signed out of/)).toBeNull();
  });

  it('has nothing to say on liveworkspace.app itself', () => {
    page.app = null;
    noteSignedOutHere();
    render(<AppAccountControl />);
    expect(screen.queryByText(/^Signed out of/)).toBeNull();
  });
});
