// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { dropSettingsLink, readSettingsLink } from '@liveworkspace/workbench/lib/settings-link';

describe('the Settings deep link', () => {
  it('names a category and, optionally, a section', () => {
    expect(readSettingsLink('?settings=account&section=danger-zone')).toEqual({
      category: 'account',
      section: 'danger-zone',
    });
    expect(readSettingsLink('?settings=privacy')).toEqual({ category: 'privacy', section: null });
    expect(readSettingsLink('?x=1')).toBeNull();
  });

  it('leaves the URL once Settings closes, keeping the rest', () => {
    window.history.replaceState(
      null,
      '',
      '/document/a?view=1&settings=account&section=danger-zone#t',
    );
    dropSettingsLink();
    expect(`${location.pathname}${location.search}${location.hash}`).toBe('/document/a?view=1#t');
  });
});
