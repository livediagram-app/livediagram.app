// @vitest-environment jsdom

// The MCP consent screen (docs/specs/015-api/mcp-server.md §3): a registered client wears Unverified App, says it is
// not made by liveworkspace, and shows the host its access goes to first; the built-in CLI keeps the quiet line.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SignInGate } from '../../hooks/auth/useSignInGate';
import type { OauthPagesConfig } from './oauth-chrome';
import { createOauthConsentPage } from './OauthConsentPage';

let search = 'session=s1';
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(search),
}));
const exchange = vi.fn<(...args: unknown[]) => Promise<unknown>>();
const revoke = vi.fn<(...args: unknown[]) => Promise<unknown>>();
vi.mock('../../lib/api/oauth', () => ({
  apiExchangeOauthToken: (...args: unknown[]) => exchange(...args),
}));
vi.mock('../../lib/api/tokens', () => ({
  apiRevokeTokenAsItself: (...args: unknown[]) => revoke(...args),
}));

const MCP = 'https://mcp.example.app';
let signIn: { gate: SignInGate; accountUserId: string | null };
const onTokenCreated = vi.fn();
let session: Record<string, unknown> | null;
let redirectTo: string;

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
const Page = createOauthConsentPage(CONFIG);

beforeEach(() => {
  search = 'session=s1';
  signIn = { gate: 'signed-in', accountUserId: 'user_1' };
  session = { clientName: 'Notion', redirectHost: 'evil.test', clientId: 'c1', verified: false };
  redirectTo = 'javascript:alert(1)';
  exchange.mockReset().mockResolvedValue({ token: 'lwt_x', id: 't1', name: null, expiresAt: 9 });
  revoke.mockReset().mockResolvedValue(undefined);
  onTokenCreated.mockReset();
  vi.stubGlobal('fetch', async (url: string) => {
    if (url === `${MCP}/oauth/session/s1`)
      return session ? Response.json(session) : Response.json({}, { status: 404 });
    if (url === `${MCP}/oauth/complete`) return Response.json({ redirectTo });
    return Response.json({}, { status: 500 });
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('/oauth/consent', () => {
  it('marks a registered client unverified and puts where access goes first', async () => {
    render(<Page />);
    expect(await screen.findByRole('heading', { name: 'Connect Notion' })).toBeTruthy();
    expect(screen.getByText('Unverified App')).toBeTruthy();
    const note = screen.getByRole('note');
    expect(note.textContent).toContain(
      'Notion is not made by liveworkspace, and we can’t check who made it.',
    );
    expect(note.textContent).toContain('Access will be sent to evil.test.');
    // The warning comes before the request itself.
    const paragraph = screen.getByText(/wants to act as you/);
    expect(note.compareDocumentPosition(paragraph) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(paragraph.textContent).toContain('example among them');
  });

  it('still warns a registered client with no host to show', async () => {
    session = { clientName: 'Notion', redirectHost: '', clientId: 'c1' };
    render(<Page />);
    await screen.findByRole('heading', { name: 'Connect Notion' });
    expect(screen.getByRole('note').textContent).toContain(
      'Only continue if you started this connection yourself.',
    );
  });

  it('keeps the quiet line for the built-in CLI', async () => {
    session = {
      clientName: 'example CLI',
      redirectHost: '127.0.0.1:5',
      clientId: 'example-cli',
      verified: true,
    };
    render(<Page />);
    await screen.findByRole('heading', { name: 'Connect example CLI' });
    expect(screen.queryByText('Unverified App')).toBeNull();
    expect(screen.queryByRole('note')).toBeNull();
    expect(screen.getByText(/Access will be sent to/).textContent).toContain('127.0.0.1:5');
  });

  it('never navigates to a script target, and names the CLI to telemetry by its id', async () => {
    session = {
      clientName: 'example CLI',
      redirectHost: '127.0.0.1:5',
      clientId: 'example-cli',
      verified: true,
    };
    render(<Page />);
    await screen.findByRole('heading', { name: 'Connect example CLI' });
    fireEvent.click(screen.getByRole('button', { name: /Read-only access/ }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Connect' }));
    });
    expect(exchange).toHaveBeenCalledWith('user_1', 'example CLI', true);
    expect(onTokenCreated).toHaveBeenCalledWith('Cli');
    expect(screen.getByRole('alert').textContent).toBe('Something went wrong. Please try again.');
  });

  it('counts another client as MCP and says when the request expired', async () => {
    render(<Page />);
    await screen.findByRole('heading', { name: 'Connect Notion' });
    session = null;
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Connect' }));
    });
    expect(exchange).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toBe(
      'This request has expired. Start the connection again from your app.',
    );
  });

  it('reports a refused handover and revokes the token', async () => {
    vi.stubGlobal('fetch', async (url: string) =>
      url === `${MCP}/oauth/session/s1`
        ? Response.json(session)
        : Response.json({}, { status: 400 }),
    );
    render(<Page />);
    await screen.findByRole('heading', { name: 'Connect Notion' });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Connect' }));
    });
    expect(revoke).toHaveBeenCalledWith('lwt_x');
    expect(onTokenCreated).not.toHaveBeenCalled();
  });

  it('sends a registered client to its redirect on success', async () => {
    redirectTo = 'https://evil.test/cb?code=1';
    render(<Page />);
    await screen.findByRole('heading', { name: 'Connect Notion' });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Connect' }));
    });
    expect(onTokenCreated).toHaveBeenCalledWith('MCP');
  });

  it('blocks on an expired or missing session, and cancels from any step', async () => {
    session = null;
    const page = render(<Page />);
    expect(screen.getByText('Checking this request…')).toBeTruthy();
    expect(await screen.findByRole('heading', { name: 'This link has expired' })).toBeTruthy();
    search = '';
    page.rerender(<Page />);
    expect(screen.getByRole('heading', { name: 'This link has expired' })).toBeTruthy();
    page.unmount();

    signIn = { gate: 'waiting', accountUserId: null };
    const waiting = render(<Page />);
    expect(screen.getByText('Loading…')).toBeTruthy();
    signIn = { gate: 'sign-in', accountUserId: null };
    await act(async () => waiting.rerender(<Page />));
    expect(screen.getByRole('heading', { name: /Sign in to connect/ })).toBeTruthy();
    expect(
      screen.getByText('You need to be signed in to connect an app to your drawings.'),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('heading', { name: 'Connection cancelled' })).toBeTruthy();
  });
});
