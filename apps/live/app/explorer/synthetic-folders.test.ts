import { describe, expect, it } from 'vitest';
import type { ExplorerViewProps } from './explorer-view-props';
import { visibleSyntheticFolders } from './synthetic-folders';

const noop = () => {};
const base = {
  showUnsortedRow: false,
  unsortedCount: 0,
  onOpenUnsorted: noop,
} as unknown as ExplorerViewProps;

describe('visibleSyntheticFolders', () => {
  it('shows nothing when no row is asked for', () => {
    expect(visibleSyntheticFolders(base)).toEqual([]);
  });

  it('lists the asked-for rows in the fixed order, with their counts', () => {
    const rows = visibleSyntheticFolders({
      ...base,
      showDynamicRow: true,
      dynamicCount: 9,
      onOpenDynamic: noop,
      showUnsortedRow: true,
      unsortedCount: 2,
      showOfflineRow: true,
      offlineCount: 1,
      onOpenOffline: noop,
      showGeneratedRow: true,
      onOpenGenerated: noop,
    });
    expect(rows.map((r) => [r.kind, r.count])).toEqual([
      ['unsorted', 2],
      ['generated', 0],
      ['offline', 1],
      ['dynamic', 9],
    ]);
  });

  it('skips an optional row whose opener is missing', () => {
    expect(visibleSyntheticFolders({ ...base, showGeneratedRow: true })).toEqual([]);
  });
});
