import { describe, expect, it } from 'vitest';
import { firstTabToLoad, isTabOutOfScope } from './tab-scope';

// docs/specs/013-workspace/tab-scoped-share-links.md: a visitor on a tab-scoped link can open their tab only.
describe('isTabOutOfScope', () => {
  it('leaves every tab open to an unscoped session', () => {
    expect(isTabOutOfScope('t1', null)).toBe(false);
  });

  it('closes every tab but the scoped one', () => {
    expect(isTabOutOfScope('t1', 't2')).toBe(true);
    expect(isTabOutOfScope('t2', 't2')).toBe(false);
  });
});

describe('firstTabToLoad', () => {
  const tabs = [{ id: 't1' }, { id: 't2' }];

  it('is the first tab for an unscoped session', () => {
    expect(firstTabToLoad(tabs, null)).toBe('t1');
  });

  it('is the scoped tab for a scoped session, wherever it sits', () => {
    expect(firstTabToLoad(tabs, 't2')).toBe('t2');
  });

  it('is nothing for an empty diagram', () => {
    expect(firstTabToLoad([], null)).toBeNull();
  });
});
