import { describe, expect, it } from 'vitest';
import { appOfAnyOrigin, appOfOrigin } from './app-origins';
import {
  APP_ITEMS,
  APP_NAMES,
  APP_SITES,
  appOfSite,
  isAppName,
  LOCAL_PORTS,
  siteOfApp,
  siteUrl,
} from './index';
import { APP_BARE_HOSTS, workspaceRoutes, WORKBENCH_ROUTE } from './workspace-proxy';

// liveknowledge (liveknowledge/docs/specs/016-platform/platform-registration.md): a listed app from its registration,
// never held, so every list a person sees names it.
describe('liveknowledge', () => {
  it('has its port block and its lime row, last among the listed sites', () => {
    expect(LOCAL_PORTS['liveknowledge.app']).toBe(3600);
    expect(APP_SITES.at(-1)).toEqual({
      id: 'liveknowledge.app',
      name: 'liveknowledge',
      url: siteUrl('liveknowledge.app', 'https://www.liveknowledge.app'),
      pitch: 'A team knowledgebase, for people and for AI',
      accent: '#84cc16',
      deep: '#3f6212',
      light: '#a3e635',
    });
  });

  it('is an Explorer app whose items are Knowledgebases, at livedocuments’ addresses', () => {
    expect(APP_ITEMS.liveknowledge).toMatchObject({
      site: 'liveknowledge.app',
      noun: 'Knowledgebase',
      nouns: 'Knowledgebases',
      apiNoun: 'document',
      itemPath: '/document/',
      offlinePath: '/explorer/offline',
      offlineConversions: true,
      offlineStore: { db: 'liveknowledge-offline', store: 'documents' },
      imagesPath: '/api/images',
      shapeLibrariesPath: null,
    });
    expect(APP_ITEMS.liveknowledge.share.communityPath).toBe('/api/documents/:id/community');
    expect(APP_NAMES.at(-1)).toBe('liveknowledge');
    expect(isAppName('liveknowledge')).toBe(true);
    expect(siteOfApp('liveknowledge').name).toBe('liveknowledge');
    expect(appOfSite('liveknowledge.app')).toBe('liveknowledge');
  });

  it('has its origins accepted in every environment, and its bare domain sent to www.', () => {
    expect(appOfOrigin('https://www.liveknowledge.app', 'production')).toBe('liveknowledge.app');
    expect(appOfOrigin('https://staging.liveknowledge.app', 'staging')).toBe('liveknowledge.app');
    expect(appOfOrigin('http://localhost:3600', 'development')).toBe('liveknowledge.app');
    expect(appOfAnyOrigin('https://liveknowledge.app')).toBe('liveknowledge.app');
    expect(APP_BARE_HOSTS.has('liveknowledge.app')).toBe(true);
  });

  it('pairs workbenches, as an app with a CLI does', () => {
    expect(workspaceRoutes('liveknowledge')).toContain(WORKBENCH_ROUTE);
  });
});
