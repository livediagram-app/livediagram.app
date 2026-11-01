// Take Offline, Sync and Delete in the Explorer on an app's own address: offered only where the app's editor runs them
// (the registry's offlineConversions), only on the app's own items the person edits and holds themselves, and Sync
// only for a person signed in; Delete for anyone, once the Explorer has asked. Each hands over to the item's own
// address in the editor.
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Item } from '@liveworkspace/index-client';
import { APP_NAMES } from '@liveworkspace/sites';
import { takeThisBrowserDeleteConfirmed } from '@liveworkspace/explorer/this-browser';
import { offlineHandOver, offlineItemMenu, offlineRemove, offlineSyncHref } from './offline-moves';

const item = (extra: Partial<Item> = {}) =>
  ({ id: 'd1', app: 'livedocuments', access: 'edit', sharedVia: null, ...extra }) as Item;

afterEach(() => vi.unstubAllGlobals());

describe('Take Offline', () => {
  it("is on the app's own items the person can edit, and hands over to the item in the app's editor", () => {
    const menu = offlineItemMenu('livedocuments')!;
    const verbs = menu(item());
    expect(verbs.map((v) => v.label)).toEqual(['Take Offline']);
    const assign = vi.fn();
    vi.stubGlobal('window', { location: { assign } });
    void verbs[0]!.onSelect();
    expect(assign).toHaveBeenCalledWith('/document/d1?convert=take-offline&item=d1');
  });

  it('is not on another app’s item, one reached through a link, or one only viewed', () => {
    const menu = offlineItemMenu('livedocuments')!;
    expect(menu(item({ app: 'livedesign' }))).toEqual([]);
    expect(menu(item({ sharedVia: 'c1' }))).toEqual([]);
    expect(menu(item({ access: 'view' }))).toEqual([]);
  });

  it("is on every app's address, each editor running the conversions, and not on liveworkspace.app", () => {
    for (const app of APP_NAMES) expect(offlineItemMenu(app)).toBeDefined();
    expect(offlineItemMenu(null)).toBeUndefined();
  });
});

describe('Sync', () => {
  it('is offered to a person signed in, handing over to the item in the editor', () => {
    const href = offlineSyncHref('livedesign', true)!;
    expect(href({ id: 'x' } as never)).toBe('/design/x?convert=sync&item=x');
    expect(offlineSyncHref('livedesign', false)).toBeUndefined();
    expect(offlineSyncHref('liveplanner', true)!({ id: 'p' } as never)).toBe(
      '/project/p?convert=sync&item=p',
    );
    expect(offlineSyncHref(null, true)).toBeUndefined();
  });
});

describe('A request that reaches This Browser', () => {
  it("goes on to the item's own address in the app's editor, and nowhere on liveworkspace.app", () => {
    expect(offlineHandOver('livediagram')!('take-offline', 'a b')).toBe(
      '/document/a%20b?convert=take-offline&item=a+b',
    );
    expect(offlineHandOver(null)).toBeNull();
  });
});

describe('Delete', () => {
  it('notes in this tab that the Explorer asked, then hands over to the item in the editor', () => {
    const kept = new Map<string, string>();
    const session = {
      getItem: (k: string) => kept.get(k) ?? null,
      setItem: (k: string, v: string) => void kept.set(k, v),
      removeItem: (k: string) => void kept.delete(k),
    } as unknown as Storage;
    const assign = vi.fn();
    vi.stubGlobal('window', { location: { assign }, sessionStorage: session });
    offlineRemove('liveplanner')!({ id: 'p 1' } as never);
    expect(assign).toHaveBeenCalledWith('/project/p%201?convert=delete&item=p+1');
    expect(takeThisBrowserDeleteConfirmed('p 1', session)).toBe(true);
    // Its own way out, for a caller that hands one in.
    const to = vi.fn();
    offlineRemove('livedesign', to)!({ id: 'x' } as never);
    expect(to).toHaveBeenCalledWith('/design/x?convert=delete&item=x');
  });

  it("is on every app's address and not on liveworkspace.app", () => {
    for (const app of APP_NAMES) expect(offlineRemove(app)).toBeDefined();
    expect(offlineRemove(null)).toBeUndefined();
  });
});
