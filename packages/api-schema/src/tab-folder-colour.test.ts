import { describe, expect, it } from 'vitest';
import { TAB_FOLDER_COLOURS, isTabFolderColour, tabFolderColourOf } from './tab-folder-colour';

describe('tab folder colours', () => {
  it('are the eight hue names', () => {
    expect(TAB_FOLDER_COLOURS).toEqual([
      'blue',
      'violet',
      'emerald',
      'amber',
      'rose',
      'cyan',
      'orange',
      'pink',
    ]);
  });

  it('accept a hue name only', () => {
    for (const hue of TAB_FOLDER_COLOURS) expect(isTabFolderColour(hue)).toBe(true);
    for (const other of ['Blue', '#2563eb', '', null, undefined, 3, {}]) {
      expect(isTabFolderColour(other)).toBe(false);
    }
  });

  it('read anything that is not a hue name as Automatic', () => {
    expect(tabFolderColourOf('rose')).toBe('rose');
    expect(tabFolderColourOf(null)).toBeUndefined();
    expect(tabFolderColourOf('red')).toBeUndefined();
  });
});
