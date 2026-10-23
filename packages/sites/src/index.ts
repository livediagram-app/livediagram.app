// liveworkspace's sites (liveworkspace/docs/site-switcher.md): the platform first, then each app. Every
// app's logo switcher lists them in this order, so a new app is one row here.

export type SiteId =
  | 'liveworkspace.app'
  | 'livediagram.app'
  | 'liveplanner.app'
  | 'livedocuments.app'
  | 'livedesign.app';

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

// Running the apps locally (the root AGENTS.md port blocks): each site's router, or the liveworkspace
// site, takes the first port of its block, so links between the apps stay on this machine. Next
// inlines NODE_ENV, so a dev server links locally and a build links to the live sites.
export const LOCAL_PORTS: Record<SiteId, number> = {
  'liveworkspace.app': 3000,
  'livediagram.app': 3100,
  'liveplanner.app': 3200,
  'livedocuments.app': 3300,
  'livedesign.app': 3400,
};

const LOCAL = typeof process !== 'undefined' && process.env.NODE_ENV === 'development';

/** A site's address: its live origin, or its local port when `local` (a dev server by default). */
export function siteUrl(id: SiteId, live: string, local = LOCAL): string {
  return local ? `http://localhost:${LOCAL_PORTS[id]}` : live;
}

export const PLATFORM_SITE: Site = {
  id: 'liveworkspace.app',
  name: 'liveworkspace',
  url: siteUrl('liveworkspace.app', 'https://liveworkspace.app'),
  pitch: 'One account across every app',
  accent: '#64748b',
};

export const APP_SITES: readonly Site[] = [
  {
    id: 'livediagram.app',
    name: 'livediagram',
    url: siteUrl('livediagram.app', 'https://www.livediagram.app'),
    pitch: 'Diagram and draw together',
    accent: '#0ea5e9',
  },
  {
    id: 'liveplanner.app',
    name: 'liveplanner',
    url: siteUrl('liveplanner.app', 'https://www.liveplanner.app'),
    pitch: 'Plan the work together',
    accent: '#8b5cf6',
  },
  {
    id: 'livedocuments.app',
    name: 'livedocuments',
    url: siteUrl('livedocuments.app', 'https://www.livedocuments.app'),
    pitch: 'Write and present together',
    accent: '#f59e0b',
  },
  {
    id: 'livedesign.app',
    name: 'livedesign',
    url: siteUrl('livedesign.app', 'https://www.livedesign.app'),
    pitch: 'Design logos, wireframes and photos together',
    accent: '#f43f5e',
  },
];

export const SITES: readonly Site[] = [PLATFORM_SITE, ...APP_SITES];
