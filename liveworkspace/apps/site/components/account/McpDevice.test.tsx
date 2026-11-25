// @vitest-environment jsdom
// Device sign-in for the apps' CLIs (liveworkspace/docs/specs/021-mcp/mcp.md "The app MCPs fold in"): the code is
// typed, checked with the one MCP, approved with the warning in view, and the token handed over; Cancel refuses it.
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let session: { state: 'checking' } | { state: 'out' } | { state: 'in'; name: string } = {
  state: 'in',
  name: 'Ada',
};
vi.mock('@/lib/session', () => ({ useSession: () => session }));
const tracked = vi.fn<(type: string) => void>();
vi.mock('@/lib/explorer/telemetry', () => ({ trackMcpTokenCreated: (t: string) => tracked(t) }));
vi.mock('./Pitch', () => ({ ConnectPitch: () => null }));

import { McpDevice } from './McpDevice';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
let posts: { url: string; body: unknown }[];

beforeEach(() => {
  session = { state: 'in', name: 'Ada' };
  posts = [];
  tracked.mockReset();
  window.history.replaceState(null, '', '/oauth/device');
  vi.stubGlobal('fetch', async (input: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    const body = typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : undefined;
    if (method === 'POST') posts.push({ url: input, body });
    if (input.includes('/oauth/device/session/BCDF-GHJK'))
      return Response.json({
        clientName: 'livediagram CLI',
        startedAt: Date.now(),
        startedIn: null,
      });
    if (input.includes('/oauth/device/session/')) return new Response('{}', { status: 404 });
    if (input === '/api/account/tokens' && method === 'POST')
      return Response.json({ id: 't1', secret: 'lwt_cli', expiresAt: 9 }, { status: 201 });
    return Response.json({ ok: true });
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
const button = (name: string) =>
  [...container.querySelectorAll('button')].find((b) => b.textContent === name)!;
const heading = () => container.querySelector('h1')?.textContent;

async function typeCode(code: string) {
  const input = container.querySelector<HTMLInputElement>('#device-code')!;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  await act(async () => {
    setter.call(input, code);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await act(async () => button('Continue').click());
  await settle();
}

describe('McpDevice', () => {
  it('asks a signed-out visitor to sign in, back to this page', () => {
    session = { state: 'out' };
    act(() => root.render(<McpDevice />));
    expect(heading()).toBe('Sign in to connect a terminal');
    expect(container.querySelector('a')?.getAttribute('href')).toContain('oauth%2Fdevice');
  });

  it('connects a CLI from its typed code, with the warning in view', async () => {
    act(() => root.render(<McpDevice />));
    await typeCode('bcdf-ghjk');
    expect(heading()).toBe('Connect livediagram CLI');
    expect(container.textContent).toContain('Only connect if you started this');
    expect(container.textContent).toContain('Started just now.');
    await act(async () => button('Connect').click());
    await settle();
    expect(heading()).toBe('You’re connected');
    expect(posts.at(-1)).toMatchObject({
      url: 'http://localhost:3013/oauth/device/complete',
      body: { userCode: 'BCDF-GHJK', token: 'lwt_cli', expiresAt: 9 },
    });
    expect(tracked).toHaveBeenCalledWith('Cli');
  });

  it('says a code it cannot find, and lets the person try again', async () => {
    act(() => root.render(<McpDevice />));
    await typeCode('ZZZZ-ZZZZ');
    expect(heading()).toBe('We couldn’t find that code');
    await act(async () => button('Try again').click());
    expect(heading()).toBe('Connect a terminal');
  });

  it('refuses the code on Cancel, so the terminal stops waiting', async () => {
    act(() => root.render(<McpDevice />));
    await typeCode('BCDF-GHJK');
    await act(async () => button('Cancel').click());
    await settle();
    expect(posts.at(-1)).toMatchObject({
      url: 'http://localhost:3013/oauth/device/deny',
      body: { userCode: 'BCDF-GHJK' },
    });
    expect(heading()).toBe('Connection cancelled');
  });
});
