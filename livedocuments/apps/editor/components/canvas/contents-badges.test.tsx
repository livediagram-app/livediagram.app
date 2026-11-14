// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { ContentsRow } from '@/lib/page-contents';
import { contentsBadges } from './contents-badges';

// docs/specs/012-collaboration/presentation-mode.md "Setting builds up" and docs/specs/007-editor/flashcards.md "Card
// number and speaking time": what a Contents row shows beside its page's name.
afterEach(cleanup);

const row = (over: Partial<ContentsRow>) =>
  ({
    id: 'p',
    number: 1,
    name: 'Page 1',
    line: '',
    locked: false,
    aspect: 1,
    kind: 'slide',
    ...over,
  }) as ContentsRow;

describe('contentsBadges', () => {
  it("shows a slide's builds beside its name", () => {
    const { container } = render(<>{contentsBadges(row({ builds: '3 builds' }))}</>);
    expect(container.querySelector('[data-contents-builds]')?.textContent).toBe('3 builds');
  });

  it("shows a card's speaking time, and nothing on a plain page", () => {
    const { container } = render(
      <>{contentsBadges(row({ kind: 'flashcard', speakingTime: '15 sec' }))}</>,
    );
    expect(container.querySelector('[data-contents-speaking-time]')?.textContent).toBe('15 sec');
    expect(contentsBadges(row({}))).toBeNull();
  });
});
