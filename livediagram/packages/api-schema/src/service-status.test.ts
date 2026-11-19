// Reading a status check (docs/specs/009-elements/live-status.md "Reading an answer"): one case per row.
import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import type { PublicFetchResult } from '@liveworkspace/api-kit/public-fetch';
import {
  classifyStatusAnswer,
  currentServiceState,
  readStatusBody,
  STATUS_BACKOFF_MAX_MS,
  STATUS_BODY_MAX,
  STATUS_POLL_MS,
  STATUS_STALE_MS,
  STATUS_TIMEOUT_STALE_MS,
  statusWaitMs,
} from './service-status';

const bytes = (text: string) => new TextEncoder().encode(text);
const ok = (text: string): PublicFetchResult => ({ ok: true, bytes: bytes(text), url: 'u' });
const NOW = 1_700_000_000_000;

describe('readStatusBody', () => {
  it.each([
    ['none', 'up'],
    ['minor', 'degraded'],
    ['maintenance', 'degraded'],
    ['major', 'down'],
    ['critical', 'down'],
    ['Critical ', 'down'],
    ['something-new', 'up'],
  ])('reads a Statuspage indicator %s as %s', (indicator, state) => {
    const body = JSON.stringify({ page: { id: 'p' }, status: { indicator, description: 'x' } });
    expect(readStatusBody(bytes(body))).toBe(state);
  });

  it.each([
    ['ok', 'up'],
    ['UP', 'up'],
    ['pass', 'up'],
    ['healthy', 'up'],
    ['operational', 'up'],
    ['green', 'up'],
    ['online', 'up'],
    ['warn', 'degraded'],
    ['warning', 'degraded'],
    ['degraded', 'degraded'],
    ['partial', 'degraded'],
    ['minor', 'degraded'],
    ['maintenance', 'degraded'],
    ['yellow', 'degraded'],
    ['fail', 'down'],
    ['DOWN', 'down'],
    ['unhealthy', 'down'],
    ['major', 'down'],
    ['critical', 'down'],
    ['outage', 'down'],
    ['error', 'down'],
    ['red', 'down'],
    ['offline', 'down'],
    ['constructor', 'up'],
    ['banana', 'up'],
  ])('reads the health word %s as %s', (word, state) => {
    expect(readStatusBody(bytes(JSON.stringify({ status: word })))).toBe(state);
  });

  it('reads state and health when there is no status word, in that order', () => {
    expect(readStatusBody(bytes('{"state":"down"}'))).toBe('down');
    expect(readStatusBody(bytes('{"health":"warn"}'))).toBe('degraded');
    expect(readStatusBody(bytes('{"status":"ok","state":"down"}'))).toBe('up');
    expect(readStatusBody(bytes('{"status":{"code":1},"health":"fail"}'))).toBe('down');
  });

  it.each([
    ['an empty body', ''],
    ['text', 'OK'],
    ['HTML', '<!doctype html><title>Status</title>'],
    ['broken JSON', '{"status":'],
    ['a JSON array', '[{"status":"down"}]'],
    ['JSON with no word', '{"uptime":12}'],
    ['a status object with no indicator', '{"status":{"description":"down"}}'],
  ])('reads %s from a 2xx as up', (_, text) => {
    expect(readStatusBody(bytes(text))).toBe('up');
  });

  it('reads a full 64 KiB body within budget', () => {
    const pad = 'x'.repeat(STATUS_BODY_MAX - 40);
    const big = bytes(`{"pad":"${pad}","status":"down"}`);
    const spaces = bytes(`{${' '.repeat(STATUS_BODY_MAX - 2)}}`);
    let state = '';
    const ms = cpuMsOf(() => {
      for (let i = 0; i < 20; i += 1) {
        state = readStatusBody(big);
        readStatusBody(spaces);
      }
    });
    expect(state).toBe('down');
    expect(ms).toBeLessThan(cpuBudgetMs(200));
  });
});

describe('classifyStatusAnswer', () => {
  it('keeps the body’s state, with reported for anything but up', () => {
    expect(classifyStatusAnswer(ok('{"status":"pass"}'), NOW)).toEqual({
      state: 'up',
      checkedAt: NOW,
    });
    expect(classifyStatusAnswer(ok('{"status":{"indicator":"major"}}'), NOW)).toEqual({
      state: 'down',
      checkedAt: NOW,
      reason: 'reported',
    });
  });

  it('reads a 2xx too large to read as up', () => {
    expect(classifyStatusAnswer({ ok: false, reason: 'too_large', url: 'u' }, NOW)).toEqual({
      state: 'up',
      checkedAt: NOW,
    });
  });

  it('reads a failed answer as down, keeping its HTTP status', () => {
    expect(
      classifyStatusAnswer({ ok: false, reason: 'http_status', status: 503, url: 'u' }, NOW),
    ).toEqual({ state: 'down', checkedAt: NOW, reason: 'http_status', httpStatus: 503 });
    expect(classifyStatusAnswer({ ok: false, reason: 'http_status', url: 'u' }, NOW)).toEqual({
      state: 'down',
      checkedAt: NOW,
      reason: 'http_status',
    });
    for (const reason of ['timeout', 'unreachable', 'unresolved'] as const) {
      expect(classifyStatusAnswer({ ok: false, reason, url: 'u' }, NOW)).toEqual({
        state: 'down',
        checkedAt: NOW,
        reason,
      });
    }
  });

  it('reads a redirect and a refused address as unknown', () => {
    expect(
      classifyStatusAnswer({ ok: false, reason: 'too_many_redirects', url: 'u' }, NOW),
    ).toEqual({ state: 'unknown', checkedAt: NOW, reason: 'redirect' });
    for (const reason of ['private_address', 'invalid_url', 'not_https'] as const) {
      expect(classifyStatusAnswer({ ok: false, reason, url: 'u' }, NOW)).toEqual({
        state: 'unknown',
        checkedAt: NOW,
        reason: 'refused',
      });
    }
  });
});

describe('currentServiceState', () => {
  it('reads a state until it is stale, then unknown', () => {
    const status = { state: 'down', checkedAt: NOW } as const;
    expect(currentServiceState(status, NOW + STATUS_STALE_MS)).toBe('down');
    expect(currentServiceState(status, NOW + STATUS_STALE_MS + 1)).toBe('unknown');
    expect(currentServiceState(undefined, NOW)).toBe('unknown');
  });

  it('reads a timeout, which the room checks less often, until two rounds past its slowest re-check', () => {
    const status = { state: 'down', checkedAt: NOW, reason: 'timeout' } as const;
    expect(currentServiceState(status, NOW + STATUS_STALE_MS + 1)).toBe('down');
    expect(currentServiceState(status, NOW + STATUS_TIMEOUT_STALE_MS)).toBe('down');
    expect(currentServiceState(status, NOW + STATUS_TIMEOUT_STALE_MS + 1)).toBe('unknown');
  });
});

describe('statusWaitMs', () => {
  it('doubles the minute for each timeout in a row, up to the cap', () => {
    expect([0, 1, 2, 3, 4, 50].map(statusWaitMs)).toEqual([
      STATUS_POLL_MS,
      2 * STATUS_POLL_MS,
      4 * STATUS_POLL_MS,
      8 * STATUS_POLL_MS,
      STATUS_BACKOFF_MAX_MS,
      STATUS_BACKOFF_MAX_MS,
    ]);
    expect(statusWaitMs(-1)).toBe(STATUS_POLL_MS);
  });
});
