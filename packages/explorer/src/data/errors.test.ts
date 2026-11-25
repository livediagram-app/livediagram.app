// @vitest-environment jsdom
// An Explorer action's refusal (liveworkspace/docs/specs/022-interface-design/error-words.md): the index's own codes
// keep their words; anything else keeps the action's lead and says why by its class.
import { IndexError } from '@liveworkspace/index-client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { failureText } from './errors';

const LEAD = 'Couldn’t rename “Roadmap”. Try again.';

afterEach(() => vi.restoreAllMocks());

describe('failureText', () => {
  it('keeps the index’s own words for its codes', () => {
    expect(failureText(new IndexError(403, 'forbidden'), LEAD, '“Roadmap”')).toBe(
      'You can’t change “Roadmap” here.',
    );
    expect(failureText(new IndexError(404, 'not_found'), LEAD, '“Roadmap”')).toBe(
      '“Roadmap” is gone: it was moved or deleted elsewhere.',
    );
  });

  it('says why after the action’s lead, by class', () => {
    expect(failureText(new IndexError(500, 'internal'), LEAD)).toBe(
      'Couldn’t rename “Roadmap”. Something went wrong on our side. Try again in a moment.',
    );
    expect(failureText(new IndexError(401, 'unauthorized'), LEAD)).toBe(
      'Couldn’t rename “Roadmap”. You’ve been signed out. Sign in again to carry on.',
    );
    expect(failureText(new IndexError(409, 'stale'), LEAD)).toBe(
      'Couldn’t rename “Roadmap”. That changed somewhere else just now. Refresh to see the latest, then try again.',
    );
    expect(failureText(new TypeError('Failed to fetch'), LEAD)).toBe(
      'Couldn’t rename “Roadmap”. Couldn’t connect. Check your connection and try again.',
    );
    // A lead that doesn't end in "Try again." is kept whole.
    expect(failureText(new IndexError(502, 'bad_gateway'), 'Not moved.')).toBe(
      'Not moved. Something went wrong on our side. Try again in a moment.',
    );
  });

  it('says offline while the browser is', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    expect(failureText(new TypeError('Failed to fetch'), LEAD)).toBe(
      'Couldn’t rename “Roadmap”. You’re offline. Reconnect, then try again.',
    );
  });

  it('keeps the action’s own line when nothing explains it', () => {
    expect(failureText(new Error('boom'), LEAD)).toBe(LEAD);
    expect(failureText(new IndexError(400, 'mystery'), LEAD)).toBe(LEAD);
  });
});
