import { afterEach, describe, expect, it, vi } from 'vitest';
import { TELEMETRY_TYPE_PATTERN } from '@livediagram/api-schema';
import { ERROR_EMIT_CAP_PER_TYPE } from '@livediagram/telemetry-client';
import {
  apiErrorType,
  networkErrorType,
  reportApiError,
  setApiErrorReporter,
} from './error-report';
import { apiFetch } from './core';

// Attribution for api failures (docs/specs/017-telemetry/telemetry.md). Reporting the bare status made a
// spike unreadable: 297 `Http403` in one day says something is being refused
// and nothing about what. The api-client's own intent string supplies the
// missing half.

describe('apiErrorType', () => {
  it('appends the action as one PascalCase token', () => {
    expect(apiErrorType(403, 'save tab')).toBe('Http403.SaveTab');
    expect(apiErrorType(500, 'create diagram')).toBe('Http500.CreateDiagram');
    expect(apiErrorType(429, 'resolve team invite link')).toBe('Http429.ResolveTeamInviteLink');
  });

  // The ingest validator rejects anything outside its pattern and drops the
  // event silently, so a token that fails here is a total loss, not a
  // degraded one. A colon separator would do exactly that.
  it('produces a token the ingest validator accepts', () => {
    const actions = [
      'save tab',
      'save diagram meta',
      'resolve team invite link',
      'notify assigned action',
      'oauth exchange',
      'set share password',
    ];
    for (const action of actions) {
      for (const status of [400, 403, 404, 429, 500]) {
        expect(apiErrorType(status, action)).toMatch(TELEMETRY_TYPE_PATTERN);
      }
    }
  });

  // Nothing user-typed reaches these strings today, but the filter is what
  // guarantees a future action string can't smuggle in a path or an id.
  it('keeps only letters and digits, so a path or id cannot leak', () => {
    expect(apiErrorType(404, 'load /diagrams/8f3e-9a21/tabs')).toBe(
      'Http404.LoadDiagrams8f3e9a21Tabs',
    );
    expect(apiErrorType(403, 'share?code=SEKRIT')).toMatch(TELEMETRY_TYPE_PATTERN);
  });

  it('stays within the 40-character cap', () => {
    const long = apiErrorType(500, 'an extraordinarily long action name that keeps going');
    expect(long.length).toBeLessThanOrEqual(40);
    expect(long).toMatch(TELEMETRY_TYPE_PATTERN);
  });

  it('falls back to the bare status when the action has no usable characters', () => {
    expect(apiErrorType(500, '')).toBe('Http500');
    expect(apiErrorType(500, '---')).toBe('Http500');
  });
});

// A request that never got a response (docs/specs/017-telemetry/telemetry.md `Network.*`). apiFetch sees the
// URL, not the caller's action, so the label is the route with ids stripped.
describe('network failures', () => {
  afterEach(() => {
    setApiErrorReporter(null);
    vi.unstubAllGlobals();
  });

  it('labels the route without ids', () => {
    expect(networkErrorType('PUT', 'http://localhost:8787/api/diagrams/abc-123/tabs/t9')).toBe(
      'Network.Put.Diagrams.Tabs',
    );
    expect(networkErrorType('GET', '/api/share/SEKRIT')).toBe('Network.Get.Share');
  });

  it('reports a rejected fetch through apiFetch, then rethrows', async () => {
    const seen: string[] = [];
    setApiErrorReporter((t) => seen.push(t));
    vi.stubGlobal('fetch', () => Promise.reject(new TypeError('Failed to fetch')));
    await expect(apiFetch('/api/folders/f1', { method: 'DELETE' })).rejects.toThrow(
      'Failed to fetch',
    );
    expect(seen).toEqual(['Network.Delete.Folders']);
  });

  it('ignores an abort and a browser that knows it is offline', async () => {
    const seen: string[] = [];
    setApiErrorReporter((t) => seen.push(t));
    const abort = new Error('aborted');
    abort.name = 'AbortError';
    vi.stubGlobal('fetch', () => Promise.reject(abort));
    await expect(apiFetch('/api/timeline')).rejects.toThrow();
    vi.stubGlobal('navigator', { onLine: false });
    vi.stubGlobal('fetch', () => Promise.reject(new TypeError('Failed to fetch')));
    await expect(apiFetch('/api/timeline')).rejects.toThrow();
    expect(seen).toEqual([]);
  });
});

// The per-type budget (docs/specs/017-telemetry/telemetry.md). One editor stuck refetching a forbidden tab
// once made `Http403.LoadTab` nearly half of every stored event; whatever
// loops next, a page load can only ever send the cap.
describe('per-type report cap', () => {
  afterEach(() => setApiErrorReporter(null));

  it('reports each type at most the shared cap per page load', () => {
    const seen: string[] = [];
    setApiErrorReporter((t) => seen.push(t));
    for (let i = 0; i < ERROR_EMIT_CAP_PER_TYPE * 5; i++) reportApiError(403, 'load tab');
    expect(seen).toHaveLength(ERROR_EMIT_CAP_PER_TYPE);
    expect(new Set(seen)).toEqual(new Set(['Http403.LoadTab']));
  });

  it('keeps a separate budget per type, so one storm cannot hide another', () => {
    const seen: string[] = [];
    setApiErrorReporter((t) => seen.push(t));
    for (let i = 0; i < ERROR_EMIT_CAP_PER_TYPE * 2; i++) reportApiError(403, 'load tab');
    reportApiError(500, 'save tab');
    reportApiError(403, 'save tab');
    expect(seen.slice(-2)).toEqual(['Http500.SaveTab', 'Http403.SaveTab']);
  });

  it('does not spend the budget while no reporter is wired', () => {
    setApiErrorReporter(null);
    for (let i = 0; i < ERROR_EMIT_CAP_PER_TYPE * 2; i++) reportApiError(403, 'load tab');
    const seen: string[] = [];
    setApiErrorReporter((t) => seen.push(t));
    reportApiError(403, 'load tab');
    expect(seen).toEqual(['Http403.LoadTab']);
  });
});
