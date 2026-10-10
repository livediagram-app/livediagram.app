import { describe, expect, it } from 'vitest';
import type { Tab } from '@livediagram/document';
import { keepUnsavedTabChanges } from './meta-keep-local';

// docs/specs/012-collaboration/collab-race-hardening.md "Tab lists".
const t = (id: string): Tab => ({ id, name: id, elements: [] }) as Tab;

describe('keepUnsavedTabChanges', () => {
  it('keeps a tab added here before its save, after the tab it followed', () => {
    const baseline = [t('a'), t('b')];
    const before = [t('a'), t('new'), t('b')];
    const list = [t('b'), t('a'), t('peer')];
    expect(keepUnsavedTabChanges(before, list, baseline).map((x) => x.id)).toEqual([
      'b',
      'a',
      'new',
      'peer',
    ]);
  });

  it('never brings back a tab deleted here before its save', () => {
    const baseline = [t('a'), t('gone')];
    const before = [t('a')];
    const list = [t('a'), t('gone')];
    expect(keepUnsavedTabChanges(before, list, baseline).map((x) => x.id)).toEqual(['a']);
  });

  it('takes the peer list as it is when nothing here is unsaved', () => {
    const tabs = [t('a'), t('b')];
    const list = [t('b'), t('a'), t('c')];
    expect(keepUnsavedTabChanges(tabs, list, tabs)).toBe(list);
  });
});
