// @vitest-environment jsdom

// The device sign-in page (docs/specs/015-api/blueprints/cli.md "The device grant", "Presentation and UX"): the code
// is always typed, never read from the address, and the approval step warns, with when and roughly where the
// request started.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SignInGate } from '../../hooks/auth/useSignInGate';
import type { OauthPagesConfig } from './oauth-chrome';
import { createOauthDevicePage, startedLine } from './OauthDevicePage';

const exchange = vi.fn<(...args: unknown[]) => Promise<unknown>>();
const revoke = vi.fn<(...args: unknown[]) => Promise<unknown>>();
vi.mock('../../lib/api/oauth', () => ({
  apiExchangeOauthToken: (...args: unknown[]) => exchange(...args),
}));
vi.mock('../../lib/api/tokens', () => ({
  apiRevokeTokenAsItself: (...args: unknown[]) => revoke(...args),
}));

const MCP = 'https://mcp.example.app';
const NOW = Date.UTC(2026, 10, 8, 12);
let signIn: { gate: SignInGate; accountUserId: string | null };
const onTokenCreated = vi.fn();
const posted: { path: string; body: unknown }[] = [];
let session: Record<string, unknown> | null;
let completeOk: boolean;

const CONFIG: OauthPagesConfig = {
  product: 'example',
  noun: 'drawings',
  mcpOrigin: MCP,
  cliClientId: 'example-cli',
  Shell: ({ children }: { children: ReactNode }) => <main>{children}</main>,
  titleClass: 'title',
  useSignIn: () => signIn,
  onTokenCreated,
};
const Page = createOauthDevicePage(CONFIG);

beforeEach(() => {
  signIn = { gate: 'signed-in', accountUserId: 'user_1' };
  session = {
    clientName: 'example CLI',
    startedAt: NOW - 3 * 60_000,
    startedIn: { city: 'Dublin', country: 'IE' },
  };
  completeOk = true;
  posted.length = 0;
  exchange.mockReset().mockResolvedValue({ token: 'lwt_x', id: 't1', name: null, expiresAt: 9 });
  revoke.mockReset().mockResolvedValue(undefined);
  onTokenCreated.mockReset();
  vi.spyOn(Date, 'now').mockReturnValue(NOW);
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    const path = url.replace(MCP, '');
    if (path.startsWith('/oauth/device/session/'))
      return session && path.endsWith('/BCDF-GHJK')
        ? Response.json(session)
        : Response.json({ error: 'invalid_code' }, { status: 404 });
    posted.push({ path, body: typeof init?.body === 'string' ? JSON.parse(init.body) : null });
    return path === '/oauth/device/complete' && !completeOk
      ? Response.json({ error: 'invalid_code' }, { status: 400 })
      : Response.json({ ok: true });
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  window.history.replaceState(null, '', '/');
});

const typeCode = async (code: string) => {
  fireEvent.change(screen.getByLabelText('Code shown in your terminal'), {
    target: { value: code },
  });
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  });
};

describe('/oauth/device', () => {
  it('never fills the code from the address', () => {
    window.history.replaceState(null, '', '/oauth/device?code=BCDF-GHJK');
    render(<Page />);
    expect(screen.getByRole('heading', { name: 'Connect a terminal' })).toBeTruthy();
    expect(screen.getByLabelText('Code shown in your terminal')).toHaveProperty('value', '');
    expect(screen.getByText('Only enter a code shown by a terminal you are using.')).toBeTruthy();
  });

  it('warns on the approval step, with when and roughly where it started, then connects', async () => {
    render(<Page />);
    await typeCode('bcdf ghjk');
    expect(screen.getByRole('heading', { name: 'Connect example CLI' })).toBeTruthy();
    const note = screen.getByRole('note');
    expect(note.textContent).toContain(
      'Only connect if you started this in your own terminal just now.',
    );
    expect(note.textContent).toContain('Started 3 mins ago, from near Dublin, Ireland.');
    expect(note.textContent).toContain('If someone sent you a link or a code, choose Cancel.');
    expect(screen.getByText(/your drawings/)).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Connect' }));
    });
    expect(exchange).toHaveBeenCalledWith('user_1', 'example CLI', false);
    expect(posted).toEqual([
      {
        path: '/oauth/device/complete',
        body: { userCode: 'BCDF-GHJK', token: 'lwt_x', expiresAt: 9 },
      },
    ]);
    expect(onTokenCreated).toHaveBeenCalledWith('Cli');
    expect(screen.getByRole('heading', { name: 'You’re connected' })).toBeTruthy();
  });

  it('shows no started line when the server gave neither time nor place', async () => {
    session = { clientName: 'example CLI' };
    render(<Page />);
    await typeCode('BCDF-GHJK');
    expect(screen.getByRole('note').textContent).not.toContain('Started');
  });

  it('says so when the MCP refuses the token, and revokes it', async () => {
    completeOk = false;
    render(<Page />);
    await typeCode('BCDF-GHJK');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Connect' }));
    });
    expect(revoke).toHaveBeenCalledWith('lwt_x');
    expect(screen.getByRole('alert').textContent).toBe('Something went wrong. Please try again.');
    expect(onTokenCreated).not.toHaveBeenCalled();
  });

  it('lets a person try an unknown code again', async () => {
    render(<Page />);
    await typeCode('BCDF-ZZZZ');
    expect(screen.getByRole('heading', { name: 'We couldn’t find that code yet' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(screen.getByRole('heading', { name: 'Connect a terminal' })).toBeTruthy();
    await typeCode('nope');
    expect(screen.getByRole('heading', { name: 'We couldn’t find that code yet' })).toBeTruthy();
  });

  it('refuses the code on Cancel, so the terminal stops waiting', async () => {
    render(<Page />);
    await typeCode('BCDF-GHJK');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    });
    expect(posted).toEqual([{ path: '/oauth/device/deny', body: { userCode: 'BCDF-GHJK' } }]);
    expect(screen.getByRole('heading', { name: 'Connection cancelled' })).toBeTruthy();
  });

  it('waits for the session, then offers Sign in back to the plain page', async () => {
    signIn = { gate: 'waiting', accountUserId: null };
    const page = render(<Page />);
    expect(screen.getByText('Loading…')).toBeTruthy();
    window.history.replaceState(null, '', '/oauth/device?code=BCDF-GHJK');
    signIn = { gate: 'sign-in', accountUserId: null };
    await act(async () => page.rerender(<Page />));
    expect(
      screen.getByRole('heading', { name: 'Sign in to connect the example CLI' }),
    ).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Sign in' }).getAttribute('href')).toBe(
      '/sign-in/?redirect_url=%2Foauth%2Fdevice',
    );
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    });
    // No code was typed, so there is nothing to refuse.
    expect(posted).toEqual([]);
    expect(screen.getByRole('heading', { name: 'Connection cancelled' })).toBeTruthy();
  });
});

describe('startedLine', () => {
  const at = (startedAt: number | null, startedIn: { city?: string; country?: string } | null) =>
    startedLine({ clientName: 'c', startedAt, startedIn }, NOW);

  it('says when, and roughly where, as far as it knows', () => {
    expect(at(NOW - 1000, { city: 'Lima', country: 'PE' })).toBe(
      'Started just now, from near Lima, Peru.',
    );
    expect(at(NOW - 120_000, null)).toBe('Started 2 mins ago.');
    expect(at(null, { country: 'NZ' })).toBe('Started from near New Zealand.');
    expect(at(null, { city: 'Oslo' })).toBe('Started from near Oslo.');
    expect(at(null, null)).toBeNull();
  });

  it('reads a clock ahead of the server as just now, and keeps a country it cannot name', () => {
    expect(at(NOW + 60_000, null)).toBe('Started just now.');
    expect(at(null, { country: 'not a region' })).toBe('Started from near not a region.');
  });
});
