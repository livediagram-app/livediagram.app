// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { ContentsRow } from '@/lib/page-contents';
import { contentsBadges } from './contents-badges';

// docs/specs/012-collaboration/presentation-mode.md "Setting builds up": what a Contents row shows beside its page's
// name.
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
});
