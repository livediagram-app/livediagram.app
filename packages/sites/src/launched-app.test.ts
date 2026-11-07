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
import { APP_BARE_HOSTS } from './workspace-proxy';

// livehuddle, launched (livehuddle/docs/specs/005-project-roadmap/build-plan.md step 8): its row moved from
// HELD_APP_SITES into APP_SITES (liveworkspace/docs/specs/002-architecture/integrating-an-app.md "Registered before
// launch"), so every list a person sees names it, and no app is held today.
describe('a launched app (livehuddle)', () => {
  it('has its port block and its emerald row, last among the listed sites', () => {
    expect(LOCAL_PORTS['livehuddle.app']).toBe(3500);
    expect(APP_SITES.at(-1)).toEqual({
      id: 'livehuddle.app',
      name: 'livehuddle',
      url: siteUrl('livehuddle.app', 'https://www.livehuddle.app'),
      pitch: 'Meet and run workshops together',
      accent: '#10b981',
      deep: '#047857',
      light: '#34d399',
    });
    expect(SITES.map((s) => s.id)).toContain('livehuddle.app');
    expect(HELD_APP_SITES).toEqual([]);
    expect(REGISTERED_APP_SITES.map((s) => s.id)).toEqual(APP_SITES.map((s) => s.id));
  });

  it('is an Explorer app, by its items', () => {
    expect(APP_ITEMS.livehuddle).toMatchObject({
      site: 'livehuddle.app',
      noun: 'Space',
      nouns: 'Spaces',
      apiNoun: 'document',
      offlinePath: '/explorer/offline',
      offlineConversions: true,
    });
    expect(APP_ITEMS.livehuddle.share.communityPath).toBe('/api/documents/:id/community');
    expect(APP_ITEMS.liveplanner.share.communityPath).toBe('/api/projects/:id/community');
    expect(APP_NAMES).toEqual([
      'livediagram',
      'liveplanner',
      'livedocuments',
      'livedesign',
      'livehuddle',
    ]);
    expect(isAppName('livehuddle')).toBe(true);
    expect(siteOfApp('livehuddle').name).toBe('livehuddle');
    expect(appOfSite('livehuddle.app')).toBe('livehuddle');
  });

  it('has its origins accepted in every environment, and its bare domain sent to www.', () => {
    expect(appOfOrigin('https://www.livehuddle.app', 'production')).toBe('livehuddle.app');
    expect(appOfOrigin('https://staging.livehuddle.app', 'staging')).toBe('livehuddle.app');
    expect(appOfOrigin('http://localhost:3500', 'development')).toBe('livehuddle.app');
    expect(appOfAnyOrigin('https://livehuddle.app')).toBe('livehuddle.app');
    expect(APP_BARE_HOSTS.has('livehuddle.app')).toBe(true);
    // The other apps are unchanged.
    expect(appOfOrigin('https://www.livedesign.app', 'production')).toBe('livedesign.app');
    expect(appOfOrigin('http://localhost:3501', 'development')).toBeNull();
  });
});
