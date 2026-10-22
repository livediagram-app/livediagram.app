import { describe, expect, it } from 'vitest';
import {
  AGENT_PRESENCE_FOCUS_MAX,
  AGENT_PRESENCE_MAX_TTL_MS,
  AGENT_PRESENCE_MIN_TTL_MS,
  AGENT_PRESENCE_STATUS_MAX,
  AGENT_PRESENCE_TTL_MS,
  parseAgentPresenceRequest,
} from './agent-presence';

const ok = (body: unknown) => parseAgentPresenceRequest(body);

describe('parseAgentPresenceRequest', () => {
  it('reads a status, focus and ttl, defaulting the ttl and reading an empty status as none', () => {
    expect(
      ok({ status: '  adding payment service ', focus: ['n3', 'f2'], ttl: 60_000, extra: 1 }),
    ).toEqual({
      ok: true,
      value: { status: 'adding payment service', focus: ['n3', 'f2'], ttlMs: 60_000 },
    });
    expect(ok({})).toEqual({
      ok: true,
      value: { status: null, focus: [], ttlMs: AGENT_PRESENCE_TTL_MS },
    });
    expect(ok({ status: '   ' })).toMatchObject({ value: { status: null } });
  });

  it('counts the status in code points, and refuses controls and a status too long', () => {
    expect(ok({ status: '🙂'.repeat(AGENT_PRESENCE_STATUS_MAX) })).toMatchObject({ ok: true });
    expect(ok({ status: 'x'.repeat(AGENT_PRESENCE_STATUS_MAX + 1) })).toEqual({
      ok: false,
      code: 'status_too_long',
    });
    expect(ok({ status: 'a\u0007b' })).toEqual({ ok: false, code: 'invalid_status' });
    expect(ok({ status: 'a\u007fb' })).toEqual({ ok: false, code: 'invalid_status' });
    expect(ok({ status: 3 })).toEqual({ ok: false, code: 'invalid_status' });
  });

  it('refuses focus that is not a list of refs, or too long', () => {
    expect(ok({ focus: 'n3' })).toEqual({ ok: false, code: 'invalid_focus' });
    expect(ok({ focus: ['n3', ''] })).toEqual({ ok: false, code: 'invalid_focus' });
    expect(ok({ focus: [1] })).toEqual({ ok: false, code: 'invalid_focus' });
    expect(
      ok({ focus: Array.from({ length: AGENT_PRESENCE_FOCUS_MAX + 1 }, (_, i) => `n${i}`) }),
    ).toEqual({
      ok: false,
      code: 'too_many_focus',
    });
  });

  it('refuses a ttl out of range or not whole milliseconds, and a body that is not an object', () => {
    for (const ttl of [
      AGENT_PRESENCE_MIN_TTL_MS - 1,
      AGENT_PRESENCE_MAX_TTL_MS + 1,
      1500.5,
      '30000',
    ])
      expect(ok({ ttl })).toEqual({ ok: false, code: 'ttl_out_of_range' });
    expect(ok({ ttl: AGENT_PRESENCE_MIN_TTL_MS })).toMatchObject({ ok: true });
    for (const body of [null, [], 'x'])
      expect(ok(body)).toEqual({ ok: false, code: 'invalid_body' });
  });
});
