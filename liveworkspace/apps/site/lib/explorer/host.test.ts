// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import type { Item } from '@liveworkspace/index-client';
import {
  appOfUrl,
  arrival,
  arrivalNotice,
  helpHrefFor,
  itemHref,
  newItemHref,
  LAST_APP_KEY,
  offlineHref,
  readLastApp,
  retiredTarget,
  settingsOpening,
  shareUrl,
  templateHref,
} from './host';

const item = (over: Partial<Item>): Item => ({ id: 'p1', app: 'liveplanner', ...over }) as Item;

describe('which app the person came from', () => {
  it('reads ?from= first, then the referrer; from anywhere else (liveworkspace.app itself) it is in no app', () => {
    expect(arrival('?from=livedesign', 'https://www.livediagram.app/x')).toEqual({
      app: 'livedesign',
      via: 'from',
    });
    expect(arrival('', 'https://www.livediagram.app/document/1')).toEqual({
      app: 'livediagram',
      via: 'referrer',
    });
    // The account menu's Explorer on liveworkspace.app: every app's work, whatever app this browser used last.
    localStorage.setItem(LAST_APP_KEY, 'liveplanner');
    expect(arrival('?from=nope', 'https://liveworkspace.app/')).toEqual({ app: null, via: null });
    expect(arrival('', '')).toEqual({ app: null, via: null });
    expect(readLastApp()).toBe('liveplanner');
    localStorage.setItem(LAST_APP_KEY, 'nope');
    expect(readLastApp()).toBeNull();
    localStorage.removeItem(LAST_APP_KEY);
  });

  it('knows each app by its address, with or without www', () => {
    expect(appOfUrl('https://liveplanner.app/project/1')).toBe('liveplanner');
    expect(appOfUrl('https://www.livedocuments.app')).toBe('livedocuments');
    expect(appOfUrl('https://example.com')).toBeNull();
    expect(appOfUrl('not a url')).toBeNull();
  });
});

describe("every app's addresses", () => {
  it("opens an item in its own app, with its share code and the Inbox's pin", () => {
    expect(itemHref(item({ id: 'p 1' }))).toBe('https://www.liveplanner.app/project/p%201');
    expect(itemHref(item({ app: 'livediagram', id: 'd1', sharedVia: 'abc' }))).toBe(
      'https://www.livediagram.app/document/d1?s=abc',
    );
    expect(itemHref(item({}), { tabId: 't1', elementId: 'e1' })).toMatch(/#t=t1&el=e1$/);
    // An Inbox row's popover and a card ride in the same deep link.
    expect(itemHref(item({}), { tabId: 't1', elementId: 'e1', open: 'action' })).toMatch(
      /#t=t1&el=e1&open=action$/,
    );
    expect(itemHref(item({}), { cardId: 'c1' })).toMatch(/\/project\/p1#item=c1$/);
  });

  it("makes New, share links, Help and This Browser the app's own", () => {
    expect(newItemHref('liveplanner', { folderId: 'f1', teamId: 't1' })).toBe(
      'https://www.liveplanner.app/new?folder=f1&team=t1',
    );
    expect(newItemHref('livedesign', null)).toBe('https://www.livedesign.app/new');
    expect(templateHref('livedesign', 'blank-logo')).toBe(
      'https://www.livedesign.app/new?template=blank-logo',
    );
    expect(shareUrl({ code: 'xyz' } as never, item({}))).toBe(
      'https://www.liveplanner.app/project/shared?s=xyz',
    );
    expect(helpHrefFor('liveplanner')({ kind: 'home' })).toBe(
      'https://www.liveplanner.app/help/explorer/home/',
    );
    expect(helpHrefFor('livediagram')({ kind: 'home' })).toBe(
      'https://www.livediagram.app/help/explorer/explorer-page/',
    );
    expect(offlineHref('liveplanner')).toBe('https://www.liveplanner.app/explorer/offline');
  });
});

describe('addresses the Explorer used to have', () => {
  it('opens the Settings panel in place on the section `?settings=` names, notifications included', () => {
    expect(settingsOpening('notifications', 'liveplanner')).toEqual({
      app: 'liveplanner',
      scope: 'all',
      categoryId: 'account:notifications',
    });
    expect(settingsOpening('account', null)).toEqual({
      app: null,
      scope: 'all',
      categoryId: 'account:account',
    });
    expect(settingsOpening('profile', null)).toMatchObject({ categoryId: 'account:account' });
    expect(settingsOpening('tokens', null)).toMatchObject({ categoryId: 'account:tokens' });
    expect(settingsOpening('webhooks', null)).toMatchObject({ categoryId: 'account:webhooks' });
    expect(settingsOpening('data', null)).toMatchObject({ categoryId: 'account:data' });
    expect(settingsOpening('accessibility', null)).toMatchObject({
      categoryId: 'account:accessibility',
    });
    expect(settingsOpening('all', 'livedesign')).toEqual({
      app: 'livedesign',
      scope: 'all',
      categoryId: null,
    });
    expect(settingsOpening('livediagram', 'liveplanner')).toEqual({
      app: 'livediagram',
      scope: 'app',
      categoryId: null,
    });
    // An editor's own category: the side of the app the person came from, or All from no app.
    expect(settingsOpening('editor', 'liveplanner')).toEqual({
      app: 'liveplanner',
      scope: 'app',
      categoryId: null,
    });
    expect(settingsOpening('editor', null)).toEqual({ app: null, scope: 'all', categoryId: null });
    expect(settingsOpening('teams', null)).toBe('teams');
    expect(settingsOpening(null, 'liveplanner')).toBeNull();
  });

  it('replaces retired views with their successors, keeping the app', () => {
    expect(retiredTarget('profile', '?from=liveplanner')).toBe(
      '/explorer?settings=notifications&from=liveplanner',
    );
    expect(retiredTarget('activity', '?from=liveplanner')).toBe('/explorer/inbox?from=liveplanner');
    expect(retiredTarget('generated', '')).toBe('/explorer/search?q=made-by%3Aai');
    expect(retiredTarget('unsorted', '?from=livedesign')).toBe('/explorer/all?from=livedesign');
  });

  it("says why a revoked link sent the person here, in the app's words", () => {
    expect(arrivalNotice('?ended=revoked', 'liveplanner')).toBe(
      'The link you opened that plan with was revoked, so it is no longer open to you.',
    );
    expect(arrivalNotice('?ended=revoked', null)).toMatch(/that item/);
    expect(arrivalNotice('', 'liveplanner')).toBeNull();
  });
});
