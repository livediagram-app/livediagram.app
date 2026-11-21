import { describe, expect, it } from 'vitest';
import { TEST_PRODUCT, WORDED_PRODUCT } from '../testing/product';
import { TAB_FOLDER_CHANGES_MAX, TAB_FOLDER_NAME_MAX } from '../tab-folders';
import { createTabFolderTools } from './tab-folder-tools';

// Each product's docs/specs/015-api/mcp-server.md "Tab folders": the tool and fields every product declares.
describe('createTabFolderTools', () => {
  const { changeTabs, addTabFolder, addedTabFolder, listedTab } = createTabFolderTools(
    TEST_PRODUCT,
    'sketchId',
  );

  it('names change_tabs a write, in the product’s words', () => {
    expect(changeTabs.mcp.tool).toBe('change_tabs');
    expect(changeTabs.behaviour).toBe('write');
    expect(changeTabs.description).toContain('read_sketch shows each tab');
    const worded = createTabFolderTools(WORDED_PRODUCT, 'sketchId');
    expect(worded.changeTabs.description).toContain('Put a drawing');
  });

  it('takes each change by its op, refusing an unknown field, a blank or long name, and too many', () => {
    const parse = (changes: unknown[]) =>
      changeTabs.input.safeParse({ sketchId: 's1', changes }).success;
    expect(
      parse([
        { op: 'move', tab: 'A', folder: 'Plans' },
        { op: 'move', tab: 'A', folder: null },
        { op: 'rename_folder', folder: 'Plans', to: 'Planning' },
        { op: 'ungroup', folder: 'Planning' },
      ]),
    ).toBe(true);
    expect(parse([{ op: 'move', tab: 'A' }])).toBe(false);
    expect(parse([{ op: 'ungroup', folder: 'P', tab: 'A' }])).toBe(false);
    expect(parse([{ op: 'move', tab: 'A', folder: '' }])).toBe(false);
    expect(parse([{ op: 'ungroup', folder: 'x'.repeat(TAB_FOLDER_NAME_MAX + 1) }])).toBe(false);
    expect(parse([])).toBe(false);
    expect(
      parse(
        Array.from({ length: TAB_FOLDER_CHANGES_MAX + 1 }, () => ({ op: 'ungroup', folder: 'P' })),
      ),
    ).toBe(false);
  });

  it('gives add_tab an optional folder and a listed tab an optional one', () => {
    expect(addTabFolder.safeParse(undefined).success).toBe(true);
    expect(addTabFolder.safeParse('').success).toBe(false);
    expect(addedTabFolder.parse('Plans')).toBe('Plans');
    expect(listedTab.parse({ id: 't1', name: 'A' })).toEqual({ id: 't1', name: 'A' });
  });
});
