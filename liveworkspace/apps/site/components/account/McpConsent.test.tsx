// @vitest-environment jsdom
// The one MCP's consent page (liveworkspace/docs/specs/021-mcp/mcp.md): an AI tool picks its apps; an app's CLI,
// which calls one app's api, is offered no app list and is granted every app.
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/session', () => ({ useSession: () => ({ state: 'in', name: 'Ada' }) }));
const tracked = vi.fn<(type: string) => void>();
vi.mock('@/lib/explorer/telemetry', () => ({ trackMcpTokenCreated: (t: string) => tracked(t) }));
vi.mock('./Pitch', () => ({ ConnectPitch: () => null }));
vi.mock('@/lib/location-search', () => ({ useLocationSearch: () => '?session=s1' }));

import { McpConsent } from './McpConsent';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
let client: Record<string, unknown>;
let completed: unknown;
let denied: unknown;
let handedTo: string;

beforeEach(() => {
  tracked.mockReset();
  completed = null;
  denied = null;
  handedTo = 'http://127.0.0.1:9/cb?code=c';
  vi.stubGlobal('fetch', async (input: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    if (input.endsWith('/oauth/session/s1')) return Response.json(client);
    if (input === '/api/account/tokens' && method === 'POST')
      return Response.json({ id: 't1', secret: 'lwt_x', expiresAt: 9 }, { status: 201 });
    if (input.endsWith('/oauth/deny')) {
      denied = JSON.parse(init!.body as string);
      return Response.json({ error: 'invalid_session' }, { status: 400 });
    }
    if (input.endsWith('/oauth/complete')) {
      completed = JSON.parse(init!.body as string);
      return Response.json({ redirectTo: handedTo });
    }
    return Response.json({});
  });
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

const settle = () => act(async () => new Promise((r) => setTimeout(r, 0)));
const connect = async () => {
  const button = [...container.querySelectorAll('button')].find(
    (b) => b.textContent === 'Connect',
  )!;
  await act(async () => button.click());
  await settle();
};

describe('McpConsent', () => {
  it('offers an AI tool the apps, every one ticked', async () => {
    client = { clientName: 'Claude', redirectHost: 'claude.ai', verified: false, clientId: 'c1' };
    act(() => root.render(<McpConsent />));
    await settle();
    expect(container.querySelectorAll('input[type=checkbox]')).toHaveLength(5);
    await connect();
    expect(tracked).toHaveBeenCalledWith('MCP');
  });

  it('tells the AI tool on Cancel, and says it is cancelled when the request has gone', async () => {
    client = { clientName: 'Claude', redirectHost: 'claude.ai', verified: false, clientId: 'c1' };
    act(() => root.render(<McpConsent />));
    await settle();
    const cancel = [...container.querySelectorAll('button')].find(
      (b) => b.textContent === 'Cancel',
    )!;
    await act(async () => cancel.click());
    await settle();
    expect(denied).toEqual({ session: 's1' });
    expect(container.textContent).toContain('Connection cancelled');
    expect(tracked).not.toHaveBeenCalled();
  });

  // liveworkspace/docs/specs/021-mcp/mcp.md "Redirect addresses" (Work Tracker 1450).
  it('names the app and warns when the sign-in goes to an app on this computer', async () => {
    client = {
      clientName: 'Cursor',
      redirectHost: 'anysphere.cursor-retrieval',
      verified: false,
      clientId: 'c1',
      localScheme: 'cursor',
    };
    handedTo = 'cursor://anysphere.cursor-retrieval/cb?code=c';
    act(() => root.render(<McpConsent />));
    await settle();
    expect(container.textContent).toContain('Connect Cursor');
    expect(container.textContent).toContain('Cursor isn’t made by liveworkspace.');
    expect(container.textContent).toContain(
      'Access goes to an app on this computer that opens cursor:// links. Any app here can claim those links, so only continue if you just started this in Cursor.',
    );
    expect(container.textContent).not.toContain('anysphere.cursor-retrieval');
    await connect();
    // The browser stays on this page while the app opens, so it says the connection is made.
    expect(await vi.waitFor(() => container.querySelector('h1, h2')?.textContent)).toBe(
      'Connected',
    );
    expect(container.textContent).toContain('You can close this window.');
  });

  it('keeps the web address line for a sign-in going to a website', async () => {
    client = { clientName: 'Claude', redirectHost: 'claude.ai', verified: false, clientId: 'c1' };
    act(() => root.render(<McpConsent />));
    await settle();
    expect(container.textContent).toContain('Access goes to claude.ai.');
    expect(container.textContent).not.toContain('app on this computer');
  });

  it('offers an app’s CLI no app list, and grants it every app', async () => {
    client = {
      clientName: 'livediagram CLI',
      redirectHost: '127.0.0.1',
      verified: true,
      clientId: 'livediagram-cli',
    };
    act(() => root.render(<McpConsent />));
    await settle();
    expect(container.querySelectorAll('input[type=checkbox]')).toHaveLength(0);
    expect(container.textContent).toContain('from your terminal');
    await connect();
    expect(completed).toMatchObject({
      apps: ['livediagram', 'livedocuments', 'liveplanner', 'livedesign', 'liveknowledge'],
    });
    expect(tracked).toHaveBeenCalledWith('Cli');
  });
});
