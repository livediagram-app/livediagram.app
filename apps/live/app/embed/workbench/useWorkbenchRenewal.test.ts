// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { useReducer } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  WORKBENCH_RENEW_LEAD_MS,
  WORKBENCH_RENEW_RETRY_MS,
  type WorkbenchSessionResponse,
  type WorkbenchToPageMessage,
} from '@livediagram/api-schema';
import type { WorkbenchRedeemOutcome } from '@/lib/api/workbench';
import type { WorkbenchPort } from '@/lib/workbench/workbench-port';
import { workbenchTransition, type WorkbenchPhase } from './workbench-machine';

// Renewal (docs/specs/013-workspace/blueprints/workbench-embeds.md "The workbench page" step 5): `renew`
// at the lead, again every retry, a ticket swaps the session, anything else is logged and retried, and
// an unrenewed session ends `expired` at its expiry.

const { redeem, endSession } = vi.hoisted(() => ({
  redeem: vi.fn<(ticket: string) => Promise<WorkbenchRedeemOutcome>>(),
  endSession: vi.fn(async (_secret: string) => {}),
}));
vi.mock('@/lib/api/workbench', () => ({
  apiRedeemWorkbenchTicket: redeem,
  apiEndWorkbenchSession: endSession,
}));

const { useWorkbenchRenewal } = await import('./useWorkbenchRenewal');

const NOW = 1_000_000;
const TTL = 60 * 60 * 1000;
const ORIGIN = 'https://127.0.0.1:5175';
const TICKET = 'Ab3_-xYz0123456789abcd';
const SESSION: WorkbenchSessionResponse = {
  session: `lvw_${'a'.repeat(43)}`,
  documentId: 'doc-1',
  tabId: null,
  origin: ORIGIN,
  role: 'edit',
  expiresAt: NOW + TTL,
  person: { id: 'user_1', name: 'Webber', color: '#0ea5e9', pictureUrl: null },
};
const RENEWED: WorkbenchSessionResponse = {
  ...SESSION,
  session: `lvw_${'b'.repeat(43)}`,
  expiresAt: NOW + 2 * TTL,
};

function fakePort() {
  const listeners = new Set<(m: WorkbenchToPageMessage) => void>();
  const port: WorkbenchPort = {
    origin: ORIGIN,
    send: vi.fn(),
    subscribe: (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    close: vi.fn(),
  };
  const deliver = (m: WorkbenchToPageMessage) => listeners.forEach((l) => l(m));
  return { port, deliver, listeners };
}

function mount(port: WorkbenchPort | null, initial: WorkbenchPhase) {
  return renderHook(() => {
    const [phase, dispatch] = useReducer(workbenchTransition, initial);
    useWorkbenchRenewal({ phase, port, dispatch });
    return phase;
  });
}

const mounted: WorkbenchPhase = { phase: 'mounted', session: SESSION, name: 'Spinner' };
const renews = (port: WorkbenchPort) =>
  vi.mocked(port.send).mock.calls.filter(([m]) => m.type === 'livediagram:renew').length;

let log: ReturnType<typeof vi.spyOn>;
let warn: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.useFakeTimers({ now: NOW });
  redeem.mockReset();
  endSession.mockClear();
  log = vi.spyOn(console, 'info').mockImplementation(() => {});
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('useWorkbenchRenewal', () => {
  it('asks for a ticket at the lead, then every retry', () => {
    const { port } = fakePort();
    mount(port, mounted);

    act(() => vi.advanceTimersByTime(TTL - WORKBENCH_RENEW_LEAD_MS - 1));
    expect(renews(port)).toBe(0);
    act(() => vi.advanceTimersByTime(1));
    expect(port.send).toHaveBeenCalledWith({ type: 'livediagram:renew', v: 1 });
    act(() => vi.advanceTimersByTime(WORKBENCH_RENEW_RETRY_MS * 2));
    expect(renews(port)).toBe(3);
  });

  it('asks at once when the session is already inside the lead', () => {
    const { port } = fakePort();
    mount(port, { ...mounted, session: { ...SESSION, expiresAt: NOW + 1_000 } });

    act(() => vi.advanceTimersByTime(0));

    expect(renews(port)).toBe(1);
  });

  it('swaps the session on a ticket for the same document and origin, and ends the old one', async () => {
    const { port, deliver } = fakePort();
    redeem.mockResolvedValue({ kind: 'opened', session: RENEWED });
    const { result } = mount(port, mounted);

    await act(async () => deliver({ type: 'livediagram:ticket', v: 1, ticket: TICKET }));

    expect(redeem).toHaveBeenCalledWith(TICKET);
    expect(result.current).toEqual({ ...mounted, session: RENEWED });
    expect(endSession).toHaveBeenCalledWith(SESSION.session);
    expect(log).toHaveBeenCalledWith('[workbench] renewed');
  });

  it('times the next renewal from the renewed session and stops asking meanwhile', async () => {
    const { port, deliver } = fakePort();
    redeem.mockResolvedValue({ kind: 'opened', session: RENEWED });
    const { result } = mount(port, mounted);
    act(() => vi.advanceTimersByTime(TTL - WORKBENCH_RENEW_LEAD_MS));
    expect(renews(port)).toBe(1);

    await act(async () => deliver({ type: 'livediagram:ticket', v: 1, ticket: TICKET }));
    act(() => vi.advanceTimersByTime(WORKBENCH_RENEW_LEAD_MS));

    expect(result.current.phase).toBe('mounted');
    expect(renews(port)).toBe(1);
  });

  it('refuses a renewal for another document, deleting the new session, and keeps asking', async () => {
    const { port, deliver } = fakePort();
    redeem.mockResolvedValue({ kind: 'opened', session: { ...RENEWED, documentId: 'doc-2' } });
    const { result } = mount(port, mounted);

    await act(async () => deliver({ type: 'livediagram:ticket', v: 1, ticket: TICKET }));

    expect(result.current).toMatchObject({ session: SESSION });
    expect(endSession).toHaveBeenCalledWith(RENEWED.session);
    expect(warn).toHaveBeenCalledWith('[workbench] renew-failed', { reason: 'mismatch' });
  });

  it('refuses a renewal for another origin', async () => {
    const { port, deliver } = fakePort();
    redeem.mockResolvedValue({
      kind: 'opened',
      session: { ...RENEWED, origin: 'https://evil.example' },
    });
    const { result } = mount(port, mounted);

    await act(async () => deliver({ type: 'livediagram:ticket', v: 1, ticket: TICKET }));

    expect(result.current).toMatchObject({ session: SESSION });
    expect(warn).toHaveBeenCalledWith('[workbench] renew-failed', { reason: 'mismatch' });
  });

  it('logs a refused or failed renewal and keeps the session', async () => {
    const { port, deliver } = fakePort();
    const { result } = mount(port, mounted);

    redeem.mockResolvedValueOnce({ kind: 'refused', status: 401, reason: 'used' });
    await act(async () => deliver({ type: 'livediagram:ticket', v: 1, ticket: TICKET }));
    redeem.mockResolvedValueOnce({ kind: 'refused', status: 404, reason: null });
    await act(async () => deliver({ type: 'livediagram:ticket', v: 1, ticket: TICKET }));
    redeem.mockResolvedValueOnce({ kind: 'failed', status: 503 });
    await act(async () => deliver({ type: 'livediagram:ticket', v: 1, ticket: TICKET }));

    expect(result.current).toMatchObject({ session: SESSION });
    expect(warn).toHaveBeenCalledWith('[workbench] renew-failed', { reason: 'used' });
    expect(warn).toHaveBeenCalledWith('[workbench] renew-failed', { reason: 'refused' });
    expect(warn).toHaveBeenCalledWith('[workbench] renew-failed', { reason: 'unreachable' });
  });

  it('ignores every other workbench message', async () => {
    const { port, deliver } = fakePort();
    mount(port, mounted);

    await act(async () => deliver({ type: 'livediagram:theme', v: 1, colourScheme: 'dark' }));

    expect(redeem).not.toHaveBeenCalled();
  });

  it('ends an unrenewed session as expired at its expiry, and stops asking', () => {
    const { port, listeners } = fakePort();
    const { result } = mount(port, mounted);

    act(() => vi.advanceTimersByTime(TTL));

    expect(result.current).toMatchObject({ phase: 'ended', reason: 'expired' });
    const asked = renews(port);
    act(() => vi.advanceTimersByTime(WORKBENCH_RENEW_RETRY_MS * 3));
    expect(renews(port)).toBe(asked);
    expect(listeners.size).toBe(0);
  });

  it('does nothing before the page is mounted', () => {
    const { port } = fakePort();
    mount(port, { phase: 'binding', session: SESSION });

    act(() => vi.advanceTimersByTime(2 * TTL));

    expect(port.send).not.toHaveBeenCalled();
  });

  it('does nothing without a port', () => {
    const { result } = mount(null, mounted);

    act(() => vi.advanceTimersByTime(TTL - 1));

    expect(result.current.phase).toBe('mounted');
  });
});
