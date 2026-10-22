import { describe, expect, it } from 'vitest';
import { backOutTarget } from './back-out';

// docs/specs/007-editor/new-document-route.md "Escape backs out".
describe('backOutTarget', () => {
  const origin = 'https://livediagram.app';

  it('goes back to the page of ours that opened the wizard', () => {
    expect(backOutTarget({ referrer: 'https://livediagram.app/', origin, historyLength: 2 })).toBe(
      'back',
    );
    expect(
      backOutTarget({
        referrer: 'https://livediagram.app/explorer/recent',
        origin,
        historyLength: 5,
      }),
    ).toBe('back');
  });

  it('goes home with nothing of ours to go back to', () => {
    expect(backOutTarget({ referrer: '', origin, historyLength: 1 })).toBe('home');
    expect(backOutTarget({ referrer: 'https://example.com/', origin, historyLength: 3 })).toBe(
      'home',
    );
    expect(backOutTarget({ referrer: 'https://livediagram.app/', origin, historyLength: 1 })).toBe(
      'home',
    );
    expect(backOutTarget({ referrer: 'not a url', origin, historyLength: 3 })).toBe('home');
  });

  it('never goes back to the wizard itself', () => {
    expect(
      backOutTarget({
        referrer: 'https://livediagram.app/new?folder=f1',
        origin,
        historyLength: 3,
      }),
    ).toBe('home');
  });
});
