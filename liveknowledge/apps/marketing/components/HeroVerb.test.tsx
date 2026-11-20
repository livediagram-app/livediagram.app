// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HERO_COAUTHOR, HeroVerb, heroFlagPlace } from './HeroVerb';

// docs/specs/019-marketing/marketing-site.md "Hero": the co-author's name flag rides the caret without ever
// covering another word of the headline. Above the caret it covered "are" on a 390px phone, where the verb
// starts the second line.

describe('heroFlagPlace', () => {
  it('hangs below the caret while the verb is on the last line', () => {
    expect(heroFlagPlace(50, 0, 50)).toBe('below');
  });

  it('sits above the caret while the verb is on the first line', () => {
    expect(heroFlagPlace(0, 0, 50)).toBe('above');
  });

  it('hides while the verb is on a line between', () => {
    expect(heroFlagPlace(50, 0, 100)).toBe('none');
  });

  it('hangs below on a one-line headline, where nothing of it is underneath', () => {
    expect(heroFlagPlace(0, 0, 0)).toBe('below');
  });
});

describe('the flag in the headline', () => {
  // Where each word's line starts, by its text: jsdom lays nothing out.
  let tops: Record<string, number> = {};

  beforeEach(() => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: false,
      media: query,
      addEventListener() {},
      removeEventListener() {},
    }));
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        observe() {}
        disconnect() {}
      },
    );
    vi.spyOn(HTMLElement.prototype, 'offsetTop', 'get').mockImplementation(function (
      this: HTMLElement,
    ) {
      const text = this.querySelector('[data-hero-verb]') ? 'verb' : (this.textContent ?? '');
      return tops[text] ?? 0;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  const flag = () => {
    const el = [...document.querySelectorAll('[data-hero-flag]')][0] as HTMLElement;
    expect(el.textContent).toBe(HERO_COAUTHOR);
    return el.dataset.place;
  };

  it('moves below the caret when the verb starts the last line (a phone)', () => {
    tops = { What: 0, are: 0, you: 0, verb: 48, 'today?': 48 };
    render(<HeroVerb before="What are you" after="today?" />);
    expect(flag()).toBe('below');
  });

  it('hides when the verb is on a middle line (a very narrow phone)', () => {
    tops = { What: 0, are: 0, you: 48, verb: 96, 'today?': 144 };
    render(<HeroVerb before="What are you" after="today?" />);
    expect(flag()).toBe('none');
  });

  it('goes above the caret when the verb ends the first line', () => {
    tops = { What: 0, are: 0, you: 0, verb: 0, 'today?': 48 };
    render(<HeroVerb before="What are you" after="today?" />);
    expect(flag()).toBe('above');
  });
});
