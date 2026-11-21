// The Incoming Webhook door's order (docs/specs/026-plan/automations.md "Incoming Webhook"): a network past the write
// limit is turned away before a byte of the body is read or the plan is woken, whatever the call's method or type.
import { describe, expect, it, vi } from 'vitest';
import { handleAutomationHook } from './automation-hook-routes';
import type { Env } from '../types';

const URL_OF = 'https://api.test/api/hooks/automations/A/r1';
const spent = () => ({ limit: vi.fn(async () => ({ success: false })) });

describe('the webhook door', () => {
  it('answers 429 past the limit before reading the body', async () => {
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.enqueue(new TextEncoder().encode('{}'));
        controller.close();
      },
    });
    const request = new Request(URL_OF, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      duplex: 'half',
    } as RequestInit);
    const limiter = spent();
    const env = { WRITE_RATE_LIMITER: limiter, PLAN_ROOM: { get: vi.fn() } } as unknown as Env;
    const res = await handleAutomationHook(request, env);
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('60');
    expect(request.bodyUsed).toBe(false);
    // Even a GET or a non-JSON call is counted first.
    const get = await handleAutomationHook(new Request(URL_OF), env);
    expect(get.status).toBe(429);
    expect(limiter.limit).toHaveBeenCalledTimes(2);
  });

  it('answers 404 for an address that is none, asking the limiter nothing', async () => {
    const limiter = spent();
    const env = { WRITE_RATE_LIMITER: limiter } as unknown as Env;
    const res = await handleAutomationHook(
      new Request('https://api.test/api/hooks/automations/A'),
      env,
    );
    expect(res.status).toBe(404);
    expect(limiter.limit).not.toHaveBeenCalled();
  });
});
