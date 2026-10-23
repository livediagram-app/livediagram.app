import { describe, expect, it } from 'vitest';
import { PLACEMENT_DEFAULT_KEYS } from '@liveplanner/api-schema';
import {
  DEFAULT_KEY_ENTRIES,
  defaultFolderDescription,
  defaultKeyEntry,
  joinNouns,
} from './default-key-entries';

// The entries of "New projects that open as" (docs/specs/013-workspace/default-folders.md
// "Entry names"): one per key, in the keys' order, with the words a sentence uses.

describe('DEFAULT_KEY_ENTRIES', () => {
  it('holds one entry per key, in list order', () => {
    expect(DEFAULT_KEY_ENTRIES.map((e) => e.key)).toEqual(PLACEMENT_DEFAULT_KEYS);
  });

  it('names each entry as the list shows it', () => {
    expect(DEFAULT_KEY_ENTRIES.map((e) => e.label)).toEqual([
      'Plans',
      'Retrospectives',
      'Kanban boards',
    ]);
  });

  it('gives each entry the plural a sentence uses', () => {
    expect(defaultKeyEntry('mode:plan').noun).toBe('Plans');
    expect(defaultKeyEntry('template:retrospective').noun).toBe('retrospectives');
    expect(defaultKeyEntry('template:kanban').noun).toBe('Kanban boards');
  });
});

describe('joinNouns', () => {
  it('joins one, two and more with commas and a final and', () => {
    expect(joinNouns(['diagrams'])).toBe('diagrams');
    expect(joinNouns(['diagrams', 'whiteboards'])).toBe('diagrams and whiteboards');
    expect(joinNouns(['diagrams', 'whiteboards', 'retrospectives'])).toBe(
      'diagrams, whiteboards and retrospectives',
    );
  });
});

describe('defaultFolderDescription', () => {
  it('says which new projects a folder receives, in list order', () => {
    expect(defaultFolderDescription(['mode:plan'])).toBe('Default folder for new Plans');
    expect(defaultFolderDescription(['template:retrospective', 'mode:plan'])).toBe(
      'Default folder for new Plans and retrospectives',
    );
  });

  it('is empty for a folder that is no default', () => {
    expect(defaultFolderDescription([])).toBe('');
  });
});
