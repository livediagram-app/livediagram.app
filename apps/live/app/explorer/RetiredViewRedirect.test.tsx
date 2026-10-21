// @vitest-environment jsdom

// A retired Explorer address replaces itself with its successor
// (docs/specs/013-workspace/folders.md#explorer-routes), so links already out there keep working.

import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { replace } = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock('@/hooks/navigation/useAppNavigation', () => ({
  useAppNavigation: () => ({ push: vi.fn(), replace }),
}));

import { RETIRED_VIEW_TARGETS, RetiredViewRedirect } from './RetiredViewRedirect';

afterEach(() => {
  cleanup();
  replace.mockReset();
});

describe('RetiredViewRedirect', () => {
  it('replaces the retired Activity address with the Inbox', () => {
    render(<RetiredViewRedirect from="activity" />);
    expect(replace).toHaveBeenCalledWith('/explorer/inbox');
  });

  it('replaces the retired buckets with their successors', () => {
    expect(RETIRED_VIEW_TARGETS).toEqual({
      unsorted: '/explorer/all',
      dynamic: '/explorer/all',
      generated: '/explorer/search?q=made-by%3Aai',
      activity: '/explorer/inbox',
    });
  });
});
