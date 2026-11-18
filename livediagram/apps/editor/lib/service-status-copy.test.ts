import { describe, expect, it } from 'vitest';
import { STATUS_STALE_MS } from '@livediagram/api-schema';
import { checkedAgo, serviceStatusCopy } from './service-status-copy';

// docs/specs/009-elements/live-status.md "The badge": the word, the name and the tooltip, and stale reading Unknown.

const URL_A = 'https://status.example.com/api/v2/status.json';
const NOW = 1_000_000;

describe('serviceStatusCopy', () => {
  it('names an Up state with when and where', () => {
    expect(serviceStatusCopy({ state: 'up', checkedAt: NOW - 40_000 }, URL_A, NOW)).toEqual({
      state: 'up',
      word: 'Up',
      label: 'Live status: Up',
      title: 'Up',
      detail: 'Checked 40 seconds ago · status.example.com',
    });
  });

  it.each([
    [{ reason: 'reported' as const }, 'degraded', 'The service reports it'],
    [{ reason: 'http_status' as const, httpStatus: 503 }, 'down', 'Answered 503'],
    [{ reason: 'http_status' as const }, 'down', 'Answered with an error'],
    [{ reason: 'timeout' as const }, 'down', 'No answer in 5 seconds'],
    [{ reason: 'unreachable' as const }, 'down', "Couldn't connect"],
    [{ reason: 'unresolved' as const }, 'down', "The address doesn't resolve"],
    [
      { reason: 'redirect' as const },
      'unknown',
      'This address redirects: use the address it moves to',
    ],
    [{ reason: 'refused' as const }, 'unknown', "This address can't be checked"],
  ])('says why: %o', (extra, state, words) => {
    const copy = serviceStatusCopy(
      { state: state as 'down', checkedAt: NOW, ...extra },
      URL_A,
      NOW,
    );
    expect(copy.detail).toBe(`${words} · Checked just now · status.example.com`);
  });

  it('leaves the time off a URL past the cap', () => {
    const copy = serviceStatusCopy(
      { state: 'unknown', checkedAt: NOW, reason: 'too_many_sources' },
      URL_A,
      NOW,
    );
    expect(copy.detail).toBe('Too many status links in this document · status.example.com');
  });

  it('reads a stale state as Unknown, not checked recently', () => {
    const copy = serviceStatusCopy(
      { state: 'up', checkedAt: NOW - STATUS_STALE_MS - 1 },
      URL_A,
      NOW,
    );
    expect(copy.word).toBe('Unknown');
    expect(copy.detail).toBe('Not checked recently · Checked 3 minutes ago · status.example.com');
  });

  it('falls back to the text for a host it cannot read', () => {
    expect(serviceStatusCopy({ state: 'up', checkedAt: NOW }, 'not a url', NOW).detail).toBe(
      'Checked just now · not a url',
    );
  });
});

describe('checkedAgo', () => {
  it('counts seconds, then minutes, never negative', () => {
    expect(checkedAgo(NOW + 5000, NOW)).toBe('Checked just now');
    expect(checkedAgo(NOW - 61_000, NOW)).toBe('Checked 1 minute ago');
    expect(checkedAgo(NOW - 125_000, NOW)).toBe('Checked 2 minutes ago');
  });
});
