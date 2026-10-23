// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { dropSettingsLink, readSettingsLink } from './settings-link';

describe('the Settings deep link', () => {
  it('names a category and, optionally, a section', () => {
    expect(readSettingsLink('?settings=account&section=your-data')).toEqual({
      category: 'account',
      section: 'your-data',
    });
    expect(readSettingsLink('?settings=privacy')).toEqual({ category: 'privacy', section: null });
    expect(readSettingsLink('?x=1')).toBeNull();
  });

  it('leaves the URL once Settings closes, keeping the rest', () => {
    window.history.replaceState(null, '', '/design/a?view=1&settings=account&section=your-data#t');
    dropSettingsLink();
    expect(`${location.pathname}${location.search}${location.hash}`).toBe('/design/a?view=1#t');
  });
});
