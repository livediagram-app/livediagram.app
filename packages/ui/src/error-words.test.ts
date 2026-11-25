// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  errorCodeForStatus,
  errorKindOf,
  errorMessage,
  errorWords,
  failedBecause,
  ownErrorWords,
  whenBackOnline,
} from './error-words';

function goOffline() {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('errorKindOf', () => {
  it.each([
    [401, 'signed_out'],
    [403, 'no_access'],
    [404, 'not_found'],
    [410, 'not_found'],
    [409, 'conflict'],
    [429, 'rate_limited'],
    [500, 'server'],
    [503, 'server'],
    [599, 'server'],
    [0, 'unreachable'],
    [400, 'unknown'],
    [600, 'unknown'],
  ] as const)('reads status %i as %s', (status, kind) => {
    expect(errorKindOf(status)).toBe(kind);
    expect(errorKindOf({ status })).toBe(kind);
  });

  it.each([
    ['offline', 'unreachable'],
    ['network', 'unreachable'],
    ['signed_out', 'signed_out'],
    ['unauthorized', 'signed_out'],
    ['unauthenticated', 'signed_out'],
    ['forbidden', 'no_access'],
    ['no_access', 'no_access'],
    ['not_found', 'not_found'],
    ['conflict', 'conflict'],
    ['rate_limited', 'rate_limited'],
    ['too_many_requests', 'rate_limited'],
    ['server_error', 'server'],
    ['internal', 'server'],
    ['internal_error', 'server'],
    ['unavailable', 'server'],
    ['brand_new', 'unknown'],
  ] as const)('reads code %s as %s', (code, kind) => {
    expect(errorKindOf(code)).toBe(kind);
  });

  it('lets a known code win over the status, and falls back to the status for one it does not know', () => {
    expect(errorKindOf({ status: 500, code: 'forbidden' })).toBe('no_access');
    expect(errorKindOf({ status: 403, error: 'mystery' })).toBe('no_access');
    expect(errorKindOf({ status: 'x', code: 7 })).toBe('unknown');
  });

  it('reads a fetch that got no answer as unreachable, and other errors as unknown', () => {
    expect(errorKindOf(new TypeError('Failed to fetch'))).toBe('unreachable');
    expect(errorKindOf(new TypeError('Load failed'))).toBe('unreachable');
    expect(errorKindOf(new TypeError('NetworkError when attempting to fetch resource.'))).toBe(
      'unreachable',
    );
    expect(errorKindOf(new TypeError('x is not a function'))).toBe('unknown');
    expect(errorKindOf(new Error('boom'))).toBe('unknown');
    expect(errorKindOf(null)).toBe('unknown');
    expect(errorKindOf(undefined)).toBe('unknown');
  });

  it('says offline while the browser is, for a request with no answer, never for a fault or a refusal', () => {
    goOffline();
    expect(errorKindOf('offline')).toBe('offline');
    expect(errorKindOf(new TypeError('Failed to fetch'))).toBe('offline');
    expect(errorKindOf(new Error('boom'))).toBe('unknown');
    expect(errorKindOf(502)).toBe('offline');
    expect(errorKindOf(403)).toBe('no_access');
    expect(errorKindOf('signed_out')).toBe('signed_out');
  });
});

describe('errorWords', () => {
  it('says what happened and what to do for each class, with a retry only where it can help', () => {
    expect(errorWords(401)).toEqual({
      kind: 'signed_out',
      message: 'You’ve been signed out. Sign in again to carry on.',
      canRetry: false,
    });
    expect(errorWords(403)).toEqual({
      kind: 'no_access',
      message: 'You don’t have access to that. Ask its owner for access.',
      canRetry: false,
    });
    expect(errorWords(404)).toEqual({
      kind: 'not_found',
      message: 'That’s no longer there. It may have been moved or deleted.',
      canRetry: false,
    });
    expect(errorWords(409)).toMatchObject({ kind: 'conflict', canRetry: true });
    expect(errorMessage(409)).toBe(
      'That changed somewhere else just now. Refresh to see the latest, then try again.',
    );
    expect(errorWords(429)).toMatchObject({
      message: 'Too many tries just now. Wait a minute and try again.',
      canRetry: true,
    });
    expect(errorWords(500)).toMatchObject({
      message: 'Something went wrong on our side. Try again in a moment.',
      canRetry: true,
    });
    expect(errorWords('offline')).toMatchObject({
      kind: 'unreachable',
      message: 'Couldn’t connect. Check your connection and try again.',
      canRetry: true,
    });
    expect(errorWords(new Error('?'))).toEqual({
      kind: 'unknown',
      message: 'Something went wrong. Try again.',
      canRetry: true,
    });
  });

  it('says offline two ways: reconnect and try, or it tries by itself', () => {
    goOffline();
    expect(errorMessage('offline')).toBe('You’re offline. Reconnect, then try again.');
    expect(errorMessage('offline', { retriesItself: true })).toBe(
      'You’re offline. It tries again when you reconnect.',
    );
    // The "tries itself" line is only Offline's.
    expect(errorMessage(403, { retriesItself: true })).toBe(
      'You don’t have access to that. Ask its owner for access.',
    );
  });
});

describe('failedBecause', () => {
  it('puts the reason after the action, or the plain "Try again." when there is none', () => {
    expect(failedBecause('Couldn’t rename “Roadmap”.', 500)).toBe(
      'Couldn’t rename “Roadmap”. Something went wrong on our side. Try again in a moment.',
    );
    expect(failedBecause('Couldn’t rename “Roadmap”.', new Error('?'))).toBe(
      'Couldn’t rename “Roadmap”. Try again.',
    );
  });
});

describe('ownErrorWords', () => {
  const own = { offline: 'Couldn’t reach your account.', name_required: 'Give it a name.' };

  it('takes the package’s words first, then the class’s, by code and status', () => {
    expect(ownErrorWords(own, 'name_required')).toBe('Give it a name.');
    expect(ownErrorWords(own, 'offline')).toBe('Couldn’t reach your account.');
    expect(ownErrorWords(own, 'forbidden')).toBe(
      'You don’t have access to that. Ask its owner for access.',
    );
    expect(ownErrorWords(own, 'failed', 503)).toBe(
      'Something went wrong on our side. Try again in a moment.',
    );
    expect(ownErrorWords(own, 'failed')).toBe('Something went wrong. Try again.');
  });

  it('says offline over the package’s "couldn’t reach" while the browser is offline', () => {
    goOffline();
    expect(ownErrorWords(own, 'offline')).toBe('You’re offline. Reconnect, then try again.');
    expect(ownErrorWords(own, 'name_required')).toBe('Give it a name.');
  });
});

describe('errorCodeForStatus', () => {
  it.each([
    [401, 'signed_out'],
    [403, 'forbidden'],
    [404, 'not_found'],
    [410, 'not_found'],
    [409, 'conflict'],
    [429, 'rate_limited'],
    [500, 'server_error'],
    [504, 'server_error'],
    [400, 'failed'],
    [0, 'failed'],
  ] as const)('names %i %s', (status, code) => {
    expect(errorCodeForStatus(status)).toBe(code);
    // The code reads back as the status's own class.
    if (code !== 'failed') expect(errorKindOf(code)).toBe(errorKindOf(status));
  });
});

describe('whenBackOnline', () => {
  it('runs at once when already online', () => {
    const run = vi.fn();
    whenBackOnline(run)();
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('runs once on the next online event, and not after it is unsubscribed', () => {
    goOffline();
    const run = vi.fn();
    whenBackOnline(run);
    expect(run).not.toHaveBeenCalled();
    window.dispatchEvent(new Event('online'));
    window.dispatchEvent(new Event('online'));
    expect(run).toHaveBeenCalledTimes(1);

    const dropped = vi.fn();
    whenBackOnline(dropped)();
    window.dispatchEvent(new Event('online'));
    expect(dropped).not.toHaveBeenCalled();
  });
});
