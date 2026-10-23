// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ExplorerRedirect } from './ExplorerRedirect';

afterEach(() => vi.unstubAllGlobals());

describe('the old /explorer addresses', () => {
  it.each([
    ['/explorer/recent', '', '', '/explorer/recent?from=liveplanner'],
    [
      '/explorer',
      '?settings=notifications',
      '',
      '/explorer?settings=notifications&from=liveplanner',
    ],
    ['/explorer/profile', '', '', '/explorer/profile?from=liveplanner'],
    ['/explorer/team', '?id=t1', '#x', '/explorer/team?id=t1&from=liveplanner#x'],
  ])(
    '%s%s%s opens on liveworkspace.app, keeping the whole address',
    (pathname, search, hash, to) => {
      const replace = vi.fn();
      vi.stubGlobal('location', { ...window.location, pathname, search, hash, replace });
      render(<ExplorerRedirect />);
      expect(replace).toHaveBeenCalledWith(
        expect.stringMatching(new RegExp(`^https?://[^/]+${to.replace(/[?#.]/g, '\\$&')}$`)),
      );
    },
  );
});
