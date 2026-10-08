// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WORKBENCH_HANDSHAKE_MS, type WorkbenchSessionResponse } from '@livediagram/api-schema';
import type { WorkbenchRedeemOutcome } from '@/lib/api/workbench';
import type { WorkbenchEvent } from './workbench-machine';

// The handshake (docs/specs/013-workspace/blueprints/workbench-embeds.md "The workbench page" steps 1
// to 3): read, redeem, check the document, hello, wait for the ack; revoke on every failure after a
// session exists; nothing but `hello` (and `ended refused`) is sent before the ack (I8).

const { redeem, endSession } = vi.hoisted(() => ({
  redeem: vi.fn<(ticket: string) => Promise<WorkbenchRedeemOutcome>>(),
  endSession: vi.fn(async (_secret: string) => {}),
}));
vi.mock('@/lib/api/workbench', () => ({
  apiRedeemWorkbenchTicket: redeem,
  apiEndWorkbenchSession: endSession,
}));

const { runWorkbenchHandshake, useWorkbenchHandshake } = await import('./useWorkbenchHandshake');

const ORIGIN = 'https://127.0.0.1:5175';
const TICKET = 'Ab3_-xYz0123456789abcd';
const SESSION: WorkbenchSessionResponse = {
  session: `lvw_${'a'.repeat(43)}`,
  documentId: 'doc-1',
  tabId: null,
  origin: ORIGIN,
  role: 'edit',
  expiresAt: 10_000,
  person: { id: 'user_1', name: 'Webber', color: '#0ea5e9', pictureUrl: null },
};

type Listener = (event: MessageEvent) => void;

function fakeWindow(href: string, framed = true) {
  const url = new URL(href);
  const listeners = new Set<Listener>();
  const parent = { postMessage: vi.fn() };
  const win: Record<string, unknown> = {
    location: { hash: url.hash, pathname: url.pathname, search: url.search },
    history: { replaceState: vi.fn() },
    addEventListener: (_: string, l: Listener) => listeners.add(l),
    removeEventListener: (_: string, l: Listener) => listeners.delete(l),
  };
  win.parent = framed ? parent : win;
  const deliver = (data: unknown, origin = ORIGIN) =>
    listeners.forEach((l) => l({ data, origin, source: parent } as unknown as MessageEvent));
  return { win: win as unknown as Window, parent, deliver, listeners };
}

const ADDRESS = `https://livediagram.app/embed/workbench?d=doc-1#ticket=${TICKET}`;

let events: WorkbenchEvent[];
const dispatch = (e: WorkbenchEvent) => events.push(e);
let log: ReturnType<typeof vi.spyOn>;
let warn: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  events = [];
  redeem.mockReset();
  endSession.mockClear();
  log = vi.spyOn(console, 'info').mockImplementation(() => {});
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('runWorkbenchHandshake', () => {
  it('refuses an address without a ticket and redeems nothing', async () => {
    const { win } = fakeWindow('https://livediagram.app/embed/workbench?d=doc-1');

    expect(await runWorkbenchHandshake(win, dispatch)).toBeNull();

    expect(events).toEqual([{ type: 'read', ticket: null, documentId: 'doc-1' }]);
    expect(redeem).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith('[workbench] redeem-failed', {
      status: null,
      reason: 'no-ticket',
    });
  });

  it('clears the fragment before the redemption', async () => {
    const { win } = fakeWindow(ADDRESS);
    let clearedFirst = false;
    redeem.mockImplementation(async () => {
      clearedFirst = vi.mocked(win.history.replaceState).mock.calls.length === 1;
      return { kind: 'refused', status: 401, reason: 'used' };
    });

    await runWorkbenchHandshake(win, dispatch);

    expect(clearedFirst).toBe(true);
  });

  it('refuses a ticket the api refused', async () => {
    const { win, parent } = fakeWindow(ADDRESS);
    redeem.mockResolvedValue({ kind: 'refused', status: 401, reason: 'expired' });

    expect(await runWorkbenchHandshake(win, dispatch)).toBeNull();

    expect(events.at(-1)).toEqual({ type: 'redeem-refused' });
    expect(parent.postMessage).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith('[workbench] redeem-failed', {
      status: 401,
      reason: 'expired',
    });
  });

  it('fails when the api could not be reached', async () => {
    const { win } = fakeWindow(ADDRESS);
    redeem.mockResolvedValue({ kind: 'failed', status: 0 });

    await runWorkbenchHandshake(win, dispatch);

    expect(events.at(-1)).toEqual({ type: 'redeem-failed' });
    expect(warn).toHaveBeenCalledWith('[workbench] redeem-failed', { status: 0 });
  });

  it('revokes a session for another document and tells its origin it was refused', async () => {
    const { win, parent } = fakeWindow(ADDRESS);
    const other = { ...SESSION, documentId: 'doc-2' };
    redeem.mockResolvedValue({ kind: 'opened', session: other });

    expect(await runWorkbenchHandshake(win, dispatch)).toBeNull();

    expect(events.at(-1)).toEqual({ type: 'redeemed', session: other });
    expect(endSession).toHaveBeenCalledWith(SESSION.session);
    expect(parent.postMessage).toHaveBeenCalledWith(
      { type: 'livediagram:ended', v: 1, reason: 'refused' },
      ORIGIN,
    );
  });

  it('is unbound at once, and revokes, when nothing frames it', async () => {
    const { win } = fakeWindow(ADDRESS, false);
    redeem.mockResolvedValue({ kind: 'opened', session: SESSION });

    expect(await runWorkbenchHandshake(win, dispatch)).toBeNull();

    expect(events.at(-1)).toEqual({ type: 'unanswered' });
    expect(endSession).toHaveBeenCalledWith(SESSION.session);
    expect(warn).toHaveBeenCalledWith('[workbench] handshake-failed', { framed: false });
  });

  it('says hello to the session’s origin only, and binds on the ack', async () => {
    const { win, parent, deliver } = fakeWindow(ADDRESS);
    redeem.mockResolvedValue({ kind: 'opened', session: SESSION });

    const running = runWorkbenchHandshake(win, dispatch);
    await vi.waitFor(() => expect(parent.postMessage).toHaveBeenCalled());
    deliver({ type: 'livediagram:hello-ack', v: 1, name: 'Acme Editor' });
    const port = await running;

    expect(parent.postMessage).toHaveBeenCalledTimes(1);
    expect(parent.postMessage).toHaveBeenCalledWith({ type: 'livediagram:hello', v: 1 }, ORIGIN);
    expect(events.at(-1)).toEqual({ type: 'acked', name: 'Acme Editor' });
    expect(port?.origin).toBe(ORIGIN);
    expect(endSession).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith('[workbench] handshake-ok', { originHost: '127.0.0.1' });
  });

  it('ignores an ack from another origin and an invalid ack, then is unbound', async () => {
    vi.useFakeTimers();
    const { win, parent, deliver, listeners } = fakeWindow(ADDRESS);
    redeem.mockResolvedValue({ kind: 'opened', session: SESSION });

    const running = runWorkbenchHandshake(win, dispatch);
    await vi.waitFor(() => expect(parent.postMessage).toHaveBeenCalled());
    deliver({ type: 'livediagram:hello-ack', v: 1, name: 'Evil' }, 'https://evil.example');
    deliver({ type: 'livediagram:hello-ack', v: 1, name: '' });
    deliver({ type: 'livediagram:theme', v: 1, colourScheme: 'dark' });
    await vi.advanceTimersByTimeAsync(WORKBENCH_HANDSHAKE_MS);

    expect(await running).toBeNull();
    expect(events.at(-1)).toEqual({ type: 'unanswered' });
    expect(endSession).toHaveBeenCalledWith(SESSION.session);
    expect(listeners.size).toBe(0);
    expect(warn).toHaveBeenCalledWith('[workbench] handshake-failed', { framed: true });
  });
});

describe('useWorkbenchHandshake', () => {
  it('runs the handshake once, even under strict mode, and is unbound when not framed', async () => {
    window.history.replaceState(null, '', `/embed/workbench?d=doc-1#ticket=${TICKET}`);
    redeem.mockResolvedValue({ kind: 'opened', session: SESSION });
    const post = vi.spyOn(window.parent, 'postMessage');
    // jsdom's top window is its own parent: not framed, so the page is unbound.
    const { result } = renderHook(() => useWorkbenchHandshake(), { reactStrictMode: true });

    await waitFor(() => expect(result.current.phase.phase).toBe('unbound'));

    expect(redeem).toHaveBeenCalledTimes(1);
    expect(result.current.port).toBeNull();
    expect(post).not.toHaveBeenCalled();
    expect(window.location.hash).toBe('');
  });

  it('keeps the port of a bound page and lets the page dispatch ends', async () => {
    const { win, deliver } = fakeWindow(ADDRESS);
    redeem.mockResolvedValue({ kind: 'opened', session: SESSION });
    const { result } = renderHook(() => useWorkbenchHandshake(win));

    await waitFor(() => expect(result.current.phase.phase).toBe('binding'));
    act(() => deliver({ type: 'livediagram:hello-ack', v: 1, name: 'Acme Editor' }));
    await waitFor(() => expect(result.current.port).not.toBeNull());
    act(() => result.current.dispatch({ type: 'ended', reason: 'revoked' }));

    expect(result.current.port?.origin).toBe(ORIGIN);
    expect(result.current.phase).toMatchObject({ phase: 'ended', reason: 'revoked' });
  });
});
