// liveworkspace's sites (liveworkspace/docs/site-switcher.md): the platform first, then each app. Every
// app's logo switcher lists them in this order, so a new app is one row here.

export type SiteId = 'liveworkspace.app' | 'livediagram.app' | 'liveplanner.app';

export type Site = {
  id: SiteId;
  // The wordmark, lower case like the logos.
  name: string;
  url: string;
  // One line under the name: what the site is for.
  pitch: string;
  // The site's accent, for its dot in the list (its brand-500).
  accent: string;
};

export const PLATFORM_SITE: Site = {
  id: 'liveworkspace.app',
  name: 'liveworkspace',
  url: 'https://liveworkspace.app',
  pitch: 'One account across every app',
  accent: '#64748b',
};

export const APP_SITES: readonly Site[] = [
  {
    id: 'livediagram.app',
    name: 'livediagram',
    url: 'https://livediagram.app',
    pitch: 'Diagram, draw and make pages together',
    accent: '#0ea5e9',
  },
  {
    id: 'liveplanner.app',
    name: 'liveplanner',
    url: 'https://liveplanner.app',
    pitch: 'Plan the work together',
    accent: '#8b5cf6',
  },
];

export const SITES: readonly Site[] = [PLATFORM_SITE, ...APP_SITES];
