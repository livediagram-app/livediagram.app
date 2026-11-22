// @vitest-environment jsdom

// The MCP consent screen (docs/specs/015-api/mcp-server.md §3): a registered client wears Unverified App, says it is
// not made by liveworkspace, and shows the host its access goes to first; the built-in CLI keeps the quiet line.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MAX_API_TOKENS_PER_ACCOUNT } from '@liveworkspace/api-schema/api-tokens';
import { bearerSettingsRequest } from '@liveworkspace/settings-ui/token-list';
import type { SignInGate } from '../../hooks/auth/useSignInGate';
import { ApiError } from '../../lib/api/api-error';
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
// The account API's bearer door, with a signed-in person's token, over the fetch each test stubs.
vi.mock('../../lib/oauth-replaced-tokens', async (real) => ({
  ...(await real<typeof import('../../lib/oauth-replaced-tokens')>()),
  accountTokensRequest: () =>
    bearerSettingsRequest({ baseUrl: '/api/workspace/account', token: async () => 'at_1' }),
}));

const MCP = 'https://mcp.example.app';
let signIn: { gate: SignInGate; accountUserId: string | null };
const onTokenCreated = vi.fn();
let session: Record<string, unknown> | null;
let redirectTo: string;
let replaces: unknown;
let completeStatus: number;
// The account's live tokens as the bearer door lists them, what was revoked there, and whether the list fails.
const DAY = 86_400_000;
const token = (id: string, name: string, lastUsedAt: number | null, createdAt = 10 * DAY) => ({
  id,
  name,
  readOnly: false,
  createdAt,
  lastUsedAt,
  expiresAt: 400 * DAY,
});
let liveTokens: ReturnType<typeof token>[];
let accountRevoked: string[];
let listStatus: number;
const accountCalls: string[] = [];

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
  replaces = [];
  completeStatus = 200;
  liveTokens = [];
  accountRevoked = [];
  listStatus = 200;
  accountCalls.length = 0;
  exchange.mockReset().mockResolvedValue({ token: 'lwt_x', id: 't1', name: null, expiresAt: 9 });
  revoke.mockReset().mockResolvedValue(undefined);
  onTokenCreated.mockReset();
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    if (url === `${MCP}/oauth/session/s1`)
      return session ? Response.json(session) : Response.json({}, { status: 404 });
    if (url === `${MCP}/oauth/complete`) {
      completed.push(JSON.parse(init?.body as string) as Record<string, unknown>);
      return completeStatus === 200
        ? Response.json({ redirectTo, replaces })
        : Response.json({}, { status: completeStatus });
    }
    if (url.startsWith('/api/workspace/account/tokens')) {
      const method = init?.method ?? 'GET';
      accountCalls.push(`${method} ${url}`);
      if (method === 'DELETE') {
        const id = url.split('/').pop()!;
        accountRevoked.push(id);
        liveTokens = liveTokens.filter((t) => t.id !== id);
        return Response.json({ id });
      }
      return listStatus === 200
        ? Response.json({ tokens: liveTokens })
        : Response.json({ error: 'offline' }, { status: listStatus });
    }
    return Response.json({}, { status: 500 });
  });
});
const completed: Record<string, unknown>[] = [];
beforeEach(() => {
  completed.length = 0;
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

  it('keeps the quiet line for the built-in CLI, which takes its sign-in back on this computer', async () => {
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
    expect(screen.getByText(/Access will be sent/).textContent).toBe(
      'Access will be sent back to the app on this computer (127.0.0.1:5). Only continue if you started this connection yourself.',
    );
  });

  it('names a site for a built-in client that goes back to one', async () => {
    session = {
      clientName: 'example CLI',
      redirectHost: 'cli.example.app',
      clientId: 'example-cli',
      verified: true,
    };
    render(<Page />);
    await screen.findByRole('heading', { name: 'Connect example CLI' });
    expect(screen.getByText(/Access will be sent/).textContent).toBe(
      'Access will be sent to cli.example.app. Only continue if you recognise this.',
    );
  });

  it('says a loopback host is this computer, on any port', async () => {
    for (const host of ['localhost:55884', '127.0.0.1:33418', '[::1]:3000', 'localhost']) {
      session = { clientName: 'Claude Code', redirectHost: host, clientId: 'c1', verified: false };
      const page = render(<Page />);
      await screen.findByRole('heading', { name: 'Connect Claude Code' });
      const note = screen.getByRole('note');
      // Still not made by liveworkspace: the title stays.
      expect(note.textContent).toContain(
        'Claude Code is not made by liveworkspace, and we can’t check who made it.',
      );
      expect(note.textContent).toContain(
        `Access will be sent back to the app on this computer (${host}). Only continue if you started this connection yourself.`,
      );
      expect(note.textContent).not.toContain('recognise this site');
      page.unmount();
    }
  });

  it('keeps a lookalike of localhost a site', async () => {
    for (const host of ['localhost.evil.com:55884', '127.0.0.1.evil.test', 'evil-localhost']) {
      session = { clientName: 'Notion', redirectHost: host, clientId: 'c1', verified: false };
      const page = render(<Page />);
      await screen.findByRole('heading', { name: 'Connect Notion' });
      const note = screen.getByRole('note');
      expect(note.textContent).toContain(
        `Access will be sent to ${host}. Only continue if you recognise this site and started this connection yourself.`,
      );
      expect(note.textContent).not.toContain('this computer');
      page.unmount();
    }
  });

  it('reads the host from the stored session, never from the address', async () => {
    search = 'session=s1&client=Claude%20Code&to=localhost%3A55884';
    render(<Page />);
    await screen.findByRole('heading', { name: 'Connect Notion' });
    const note = screen.getByRole('note');
    expect(note.textContent).toContain('Access will be sent to evil.test.');
    expect(note.textContent).not.toContain('localhost');
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

describe('/oauth/consent, a reconnect and the token cap', () => {
  const connect = async () => {
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Connect' }));
    });
  };

  it('hands the token over with its id, then revokes exactly the one this client held', async () => {
    redirectTo = 'https://evil.test/cb?code=1';
    replaces = ['old1', 'manual', 'gone', 42];
    liveTokens = [
      token('t1', 'Notion', null),
      token('old1', 'Notion', 5 * DAY),
      // Named by the MCP, but another name: a manual token, never this client's.
      token('manual', 'Weekly script', 3 * DAY),
      // This client's name, but not one the MCP named: another install's.
      token('other', 'Notion', 2 * DAY),
    ];
    render(<Page />);
    await screen.findByRole('heading', { name: 'Connect Notion' });
    await connect();
    expect(completed).toEqual([{ session: 's1', token: 'lwt_x', expiresAt: 9, tokenId: 't1' }]);
    expect(accountRevoked).toEqual(['old1']);
    expect(liveTokens.map((t) => t.id)).toEqual(['t1', 'manual', 'other']);
    expect(onTokenCreated).toHaveBeenCalledWith('MCP');
  });

  it('revokes nothing old when the handover fails, or when there is nothing to replace', async () => {
    replaces = ['old1'];
    liveTokens = [token('t1', 'Notion', null), token('old1', 'Notion', 5 * DAY)];
    completeStatus = 400;
    const page = render(<Page />);
    await screen.findByRole('heading', { name: 'Connect Notion' });
    await connect();
    expect(revoke).toHaveBeenCalledWith('lwt_x');
    expect(accountCalls).toEqual([]);
    page.unmount();

    completeStatus = 200;
    replaces = undefined;
    redirectTo = 'https://evil.test/cb?code=1';
    render(<Page />);
    await screen.findByRole('heading', { name: 'Connect Notion' });
    await connect();
    expect(accountCalls).toEqual([]);
  });

  it('revokes nothing when the new token is not among the live ones', async () => {
    redirectTo = 'https://evil.test/cb?code=1';
    replaces = ['old1'];
    liveTokens = [token('old1', 'Notion', 5 * DAY)];
    render(<Page />);
    await screen.findByRole('heading', { name: 'Connect Notion' });
    await connect();
    expect(accountRevoked).toEqual([]);
  });

  it('still connects when the list of tokens cannot be read', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    redirectTo = 'https://evil.test/cb?code=1';
    replaces = ['old1'];
    listStatus = 503;
    render(<Page />);
    await screen.findByRole('heading', { name: 'Connect Notion' });
    await connect();
    expect(accountRevoked).toEqual([]);
    expect(onTokenCreated).toHaveBeenCalledWith('MCP');
    warn.mockRestore();
  });

  it('at the cap, lists the tokens least recently used first, and connects straight after a revoke', async () => {
    exchange.mockRejectedValueOnce(new ApiError('oauth exchange', 409, 'token_limit_reached'));
    liveTokens = [
      token('recent', 'Claude', 9 * DAY),
      token('never', 'Cursor', null, 2 * DAY),
      token('old', 'Weekly script', 4 * DAY),
    ];
    render(<Page />);
    await screen.findByRole('heading', { name: 'Connect Notion' });
    await connect();
    expect(screen.getByRole('alert').textContent).toBe(
      `Your account has reached its limit of ${MAX_API_TOKENS_PER_ACCOUNT} API tokens. Revoke one below, then connect.`,
    );
    expect(screen.getByRole('alert').textContent).toContain('20 API tokens');
    const list = await screen.findByRole('list');
    const names = [...list.querySelectorAll('li bdi')].map((n) => n.textContent);
    expect(names).toEqual(['Cursor', 'Weekly script', 'Claude']);

    // Revoke asks first, in place.
    const [firstRevoke] = screen.getAllByRole('button', { name: 'Revoke' });
    await act(async () => {
      fireEvent.click(firstRevoke!);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Revoke now' }));
    });
    expect(accountRevoked).toEqual(['never']);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByRole('status').textContent).toBe('There’s room for one more token now.');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Connect' }));
    expect(
      [...screen.getByRole('list').querySelectorAll('li bdi')].map((n) => n.textContent),
    ).toEqual(['Weekly script', 'Claude']);

    // Connect again: this time the mint goes through.
    redirectTo = 'https://evil.test/cb?code=1';
    await connect();
    expect(exchange).toHaveBeenCalledTimes(2);
    expect(onTokenCreated).toHaveBeenCalledWith('MCP');
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('says when the tokens cannot be listed, and reads them again on Try Again', async () => {
    exchange.mockRejectedValueOnce(new ApiError('oauth exchange', 409, 'token_limit_reached'));
    listStatus = 503;
    render(<Page />);
    await screen.findByRole('heading', { name: 'Connect Notion' });
    await connect();
    const alerts = await screen.findAllByRole('alert');
    expect(alerts.map((a) => a.textContent).join(' ')).toContain('Couldn’t reach liveworkspace');
    listStatus = 200;
    liveTokens = [];
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Try Again' }));
    });
    expect(
      screen.getByText('None are live just now, so there’s room: choose Connect.'),
    ).toBeTruthy();
  });
});
