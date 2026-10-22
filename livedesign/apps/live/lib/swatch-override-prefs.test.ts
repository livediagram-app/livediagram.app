// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readUserPreferences, writeUserPreferences } from './user-preferences';
import { pruneCustomThemeSwatchOverrides } from './swatch-override-prefs';

vi.mock('./api-client', () => ({ apiPutPreferences: vi.fn(), apiGetPreferences: vi.fn() }));

beforeEach(() => localStorage.clear());

describe('pruneCustomThemeSwatchOverrides', () => {
  it('drops a deleted custom theme and keeps built-in ones', () => {
    writeUserPreferences({
      quickSwatchOverrides: [
        { t: 'custom:gone', s: { 1: '#111111' } },
        { t: 'custom:kept', s: { 1: '#222222' } },
        { t: 'forest', s: { 1: '#333333' } },
      ],
    });
    pruneCustomThemeSwatchOverrides('owner', (id) => id === 'custom:kept');
    expect(readUserPreferences().quickSwatchOverrides?.map((e) => e.t)).toEqual([
      'custom:kept',
      'forest',
    ]);
  });

  it('writes nothing when there is nothing to prune', () => {
    writeUserPreferences({ tourSeen: true });
    pruneCustomThemeSwatchOverrides('owner', () => false);
    expect(readUserPreferences()).toEqual({ tourSeen: true });
  });
});
