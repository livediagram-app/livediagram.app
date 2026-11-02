import { describe, expect, it } from 'vitest';
import { appOfAnyOrigin, appOfOrigin } from './app-origins';
import {
  APP_ITEMS,
  APP_NAMES,
  APP_SITES,
  appOfSite,
  HELD_APP_SITES,
  isAppName,
  LOCAL_PORTS,
  REGISTERED_APP_SITES,
  siteOfApp,
  SITES,
  siteUrl,
} from './index';

// livehuddle, registered before its launch (liveworkspace/docs/specs/002-architecture/integrating-an-app.md
// "Registered before launch"): every service accepts it, no list a person sees shows it.
describe('a held app (livehuddle)', () => {
  it('has its port block and its emerald row, held out of every listed site', () => {
    expect(LOCAL_PORTS['livehuddle.app']).toBe(3500);
    expect(HELD_APP_SITES).toEqual([
      {
        id: 'livehuddle.app',
        name: 'livehuddle',
        url: siteUrl('livehuddle.app', 'https://www.livehuddle.app'),
        pitch: 'Meet and run workshops together',
        accent: '#10b981',
        deep: '#047857',
        light: '#34d399',
      },
    ]);
    expect(SITES.map((s) => s.id)).not.toContain('livehuddle.app');
    expect(APP_SITES.map((s) => s.id)).not.toContain('livehuddle.app');
    expect(REGISTERED_APP_SITES.map((s) => s.id)).toEqual([
      ...APP_SITES.map((s) => s.id),
      'livehuddle.app',
    ]);
  });

  it('is known by its items, and named by no Explorer list or address', () => {
    expect(APP_ITEMS.livehuddle).toMatchObject({
      site: 'livehuddle.app',
      noun: 'Space',
      nouns: 'Spaces',
      apiNoun: 'document',
      offlinePath: null,
      offlineConversions: false,
    });
    expect(APP_NAMES).toEqual(['livediagram', 'liveplanner', 'livedocuments', 'livedesign']);
    expect(isAppName('livehuddle')).toBe(false);
    expect(isAppName('livedesign')).toBe(true);
    expect(siteOfApp('livehuddle').name).toBe('livehuddle');
    expect(appOfSite('livehuddle.app')).toBe('livehuddle');
  });

  it('has its origins accepted in every environment', () => {
    expect(appOfOrigin('https://www.livehuddle.app', 'production')).toBe('livehuddle.app');
    expect(appOfOrigin('https://staging.livehuddle.app', 'staging')).toBe('livehuddle.app');
    expect(appOfOrigin('http://localhost:3500', 'development')).toBe('livehuddle.app');
    expect(appOfAnyOrigin('https://livehuddle.app')).toBe('livehuddle.app');
    // The listed apps are unchanged.
    expect(appOfOrigin('https://www.livedesign.app', 'production')).toBe('livedesign.app');
    expect(appOfOrigin('http://localhost:3501', 'development')).toBeNull();
  });
});
