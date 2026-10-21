// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  parseSettingsView,
  readSettingsView,
  SETTINGS_VIEW_STORAGE_KEY,
  writeSettingsView,
} from './settings-view-memory';

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('settings view memory', () => {
  it('round-trips the category and scroll anchor', () => {
    writeSettingsView({ categoryId: 'panels', anchor: { rowKey: 'minimap', offset: -12 } });
    expect(readSettingsView()).toEqual({
      categoryId: 'panels',
      anchor: { rowKey: 'minimap', offset: -12 },
    });
  });

  it('keeps a phone root-list close as a null category', () => {
    writeSettingsView({ categoryId: null, anchor: null });
    expect(readSettingsView()).toEqual({ categoryId: null, anchor: null });
  });

  it('reads nothing when nothing was stored', () => {
    expect(readSettingsView()).toBeNull();
  });

  it.each([
    ['not json', '{'],
    ['a non-object', '42'],
    ['a numeric category', '{"categoryId":3,"anchor":null}'],
    ['a missing anchor', '{"categoryId":"editor"}'],
    ['an anchor without a row', '{"categoryId":"editor","anchor":{"offset":4}}'],
    ['a non-finite offset', '{"categoryId":"editor","anchor":{"rowKey":"a","offset":"x"}}'],
  ])('rejects %s', (_label, raw) => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(parseSettingsView(raw)).toBeNull();
  });

  it('warns with its fingerprint when storage throws, and reads nothing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    expect(readSettingsView()).toBeNull();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('[settings-view]'),
      expect.anything(),
    );
  });

  it('warns rather than throwing when a write fails', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    expect(() => writeSettingsView({ categoryId: 'editor', anchor: null })).not.toThrow();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('[settings-view]'),
      expect.anything(),
    );
    expect(localStorage.getItem(SETTINGS_VIEW_STORAGE_KEY)).toBeNull();
  });
});
