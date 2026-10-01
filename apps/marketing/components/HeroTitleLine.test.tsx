// @vitest-environment jsdom
import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HeroTitleLine } from './HeroTitleLine';

function stubMotion(reduce: boolean) {
  vi.stubGlobal(
    'matchMedia',
    (query: string) =>
      ({
        matches: reduce && query.includes('reduce'),
        media: query,
        addEventListener() {},
        removeEventListener() {},
        addListener() {},
        removeListener() {},
      }) as unknown as MediaQueryList,
  );
}

// The word showing is the slot's one entry that is neither hidden nor leaving.
function shownWord(container: HTMLElement) {
  const words = [...container.querySelectorAll('.hero-word-slot > span')];
  return words.find((w) => !/invisible|hero-word-out/.test(w.className))?.textContent;
}

// docs/specs/019-marketing/marketing-site.md "Hero": the first word cycles every 1.5s.
describe('the hero headline word', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        disconnect() {}
      },
    );
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('cycles Diagram, Document, Whiteboard, Brainstorm, 1.5s each, then wraps', () => {
    stubMotion(false);
    const { container } = render(<HeroTitleLine> together</HeroTitleLine>);
    const seen = [shownWord(container)];
    for (let i = 0; i < 4; i++) {
      act(() => vi.advanceTimersByTime(1499));
      expect(shownWord(container)).toBe(seen.at(-1));
      act(() => vi.advanceTimersByTime(1));
      seen.push(shownWord(container));
    }
    expect(seen).toEqual(['Diagram', 'Document', 'Whiteboard', 'Brainstorm', 'Diagram']);
  });

  it('holds Diagram under reduced motion', () => {
    stubMotion(true);
    const { container } = render(<HeroTitleLine> together</HeroTitleLine>);
    act(() => vi.advanceTimersByTime(6000));
    expect(shownWord(container)).toBe('Diagram');
  });
});
