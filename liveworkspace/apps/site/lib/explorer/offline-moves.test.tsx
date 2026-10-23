// Take Offline and Sync in the Explorer on an app's own address: offered only where the app's This Browser page runs
// them (the registry's offlineConversions), only on the app's own items the person edits and holds themselves, and
// Sync only for a person signed in. Each hands over to that page's address.
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Item } from '@liveworkspace/index-client';
import { offlineItemMenu, offlineSyncHref } from './offline-moves';

const item = (extra: Partial<Item> = {}) =>
  ({ id: 'd1', app: 'livedocuments', access: 'edit', sharedVia: null, ...extra }) as Item;

afterEach(() => vi.unstubAllGlobals());

describe('Take Offline', () => {
  it("is on the app's own items the person can edit, and hands over to its This Browser page", () => {
    const menu = offlineItemMenu('livedocuments')!;
    const verbs = menu(item());
    expect(verbs.map((v) => v.label)).toEqual(['Take Offline']);
    const assign = vi.fn();
    vi.stubGlobal('window', { location: { assign } });
    verbs[0]!.onSelect();
    expect(assign).toHaveBeenCalledWith('/offline?convert=take-offline&item=d1');
  });

  it('is not on another app’s item, one reached through a link, or one only viewed', () => {
    const menu = offlineItemMenu('livedocuments')!;
    expect(menu(item({ app: 'livedesign' }))).toEqual([]);
    expect(menu(item({ sharedVia: 'c1' }))).toEqual([]);
    expect(menu(item({ access: 'view' }))).toEqual([]);
  });

  it("is nowhere the app's page runs no conversions, nor on liveworkspace.app", () => {
    expect(offlineItemMenu('liveplanner')).toBeUndefined();
    expect(offlineItemMenu(null)).toBeUndefined();
  });
});

describe('Sync', () => {
  it('is offered to a person signed in, handing over to the page', () => {
    const href = offlineSyncHref('livedesign', true)!;
    expect(href({ id: 'x' } as never)).toBe('/offline?convert=sync&item=x');
    expect(offlineSyncHref('livedesign', false)).toBeUndefined();
    expect(offlineSyncHref('liveplanner', true)).toBeUndefined();
  });
});
