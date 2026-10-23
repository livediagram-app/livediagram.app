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
  // The site's accent (its brand-500): its prism's tint, and "live" in its wordmark on dark.
  accent: string;
  // Its deep shade (brand-700): "live" in its wordmark on light, where the accent is too pale.
  deep: string;
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

// Declared here rather than through @types/node: the apps that compile this source don't all load
// Node's types, and the bundlers replace `process.env.NODE_ENV` by name at build time.
declare const process: { env: Record<string, string | undefined> } | undefined;

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
  deep: '#334155',
};

export const APP_SITES: readonly Site[] = [
  {
    id: 'livediagram.app',
    name: 'livediagram',
    url: siteUrl('livediagram.app', 'https://www.livediagram.app'),
    pitch: 'Diagram and draw together',
    accent: '#0ea5e9',
    deep: '#0369a1',
  },
  {
    id: 'liveplanner.app',
    name: 'liveplanner',
    url: siteUrl('liveplanner.app', 'https://www.liveplanner.app'),
    pitch: 'Plan the work together',
    accent: '#8b5cf6',
    deep: '#6d28d9',
  },
  {
    id: 'livedocuments.app',
    name: 'livedocuments',
    url: siteUrl('livedocuments.app', 'https://www.livedocuments.app'),
    pitch: 'Write and present together',
    accent: '#f59e0b',
    deep: '#b45309',
  },
  {
    id: 'livedesign.app',
    name: 'livedesign',
    url: siteUrl('livedesign.app', 'https://www.livedesign.app'),
    pitch: 'Design logos, wireframes and photos together',
    accent: '#f43f5e',
    deep: '#be123c',
  },
];

export const SITES: readonly Site[] = [PLATFORM_SITE, ...APP_SITES];

// ---------- The apps' items, for the Explorer on liveworkspace.app ----------------------------------------------
// The Explorer lives once, at liveworkspace.app/explorer (liveworkspace/docs/one-explorer.md). It lists every app's
// items, so it needs each app's word for one item, where the app opens one, where it makes one, and where its own
// offline view is. Keyed by the app's name as the index knows it (`@liveworkspace/index-client` APPS).

export type AppName = 'livediagram' | 'liveplanner' | 'livedocuments' | 'livedesign';

export type AppItems = {
  // The site, for its name, address and colours.
  site: SiteId;
  // One item, and many: the word people see ("Plan", "Plans").
  noun: string;
  nouns: string;
  // Where the app opens one item: `${url}${itemPath}<id>`.
  itemPath: string;
  // Where the app makes one: `${url}${newPath}` (`?folder=`, `?team=` and `?template=` ride on it).
  newPath: string;
  // The app's view of what is kept only in this browser (its offline items), when it has one.
  offlinePath: string | null;
  // Whether the app's items are listed by the index yet. Until they are, the app keeps its own /explorer.
  onIndex: boolean;
  // Its share link: `${url}${sharePath}<code>`.
  sharePath: string;
  // An item's preview, an SVG its API serves to anyone the item is open to (the index's grant decides), with `:id`
  // for the item's id; `?v=<updatedAt>` keeps a cached one fresh. Null while the app serves none to other sites, and
  // the Explorer on liveworkspace.app draws the kind's icon instead.
  previewPath: string | null;
  // What the Share dialog offers beyond a link's address, as the app serves it (address patterns on its site).
  share: AppShare;
};

/** The Share dialog's extras an app serves, so the Explorer on liveworkspace.app offers them for its items without
 *  any of the app's code. Each is a pattern on the app's site: `:code` is a share link's code, `:id` an item's. */
export type AppShare = {
  // A pass's embed (an <iframe> at the link's level), or null when the app has none.
  embedPath: string | null;
  // A pass's live image, an SVG that redraws as the item changes; `?tab=<tab id>` picks a tab. Null when none.
  liveImagePath: string | null;
  // The live image's alt text in its Markdown and HTML snippets.
  liveImageAlt: string;
  // An item's tabs, so a pass can open one: the item read the app's API answers the workspace token with, and the
  // key its answer keeps the item under (`{ [tabsKey]: { tabs: [{ id, name }] } }`). Null: passes open every tab.
  tabsPath: string | null;
  tabsKey: string;
  // The app's help articles on sharing, under `${url}/help/`.
  help: { sharing: string; shareLinkExpiry: string; sharePasswords: string };
};

// Every app's help centre keeps sharing under the same three addresses.
const SHARE_HELP = {
  sharing: 'collaboration/sharing',
  shareLinkExpiry: 'collaboration/sharing/share-link-expiry',
  sharePasswords: 'collaboration/sharing/share-passwords',
};

// Every app serves its embeds and live images at the same addresses.
const shareOf = (tabsPath: string, tabsKey: string, alt: string): AppShare => ({
  embedPath: '/embed?s=:code',
  liveImagePath: '/api/share/:code/image.svg',
  liveImageAlt: alt,
  tabsPath,
  tabsKey,
  help: SHARE_HELP,
});

export const APP_ITEMS: Record<AppName, AppItems> = {
  livediagram: {
    site: 'livediagram.app',
    noun: 'Canvas',
    nouns: 'Canvases',
    itemPath: '/document/',
    newPath: '/new',
    offlinePath: '/explorer/offline',
    onIndex: false,
    sharePath: '/document/shared?s=',
    previewPath: null,
    share: shareOf('/api/documents/:id', 'document', 'livediagram tab'),
  },
  liveplanner: {
    site: 'liveplanner.app',
    noun: 'Plan',
    nouns: 'Plans',
    itemPath: '/project/',
    newPath: '/new',
    offlinePath: '/offline',
    onIndex: true,
    sharePath: '/project/shared?s=',
    previewPath: '/api/projects/:id/thumbnail',
    share: shareOf('/api/projects/:id', 'project', 'liveplanner tab'),
  },
  livedocuments: {
    site: 'livedocuments.app',
    noun: 'Document',
    nouns: 'Documents',
    itemPath: '/document/',
    newPath: '/new',
    offlinePath: '/explorer/offline',
    onIndex: false,
    sharePath: '/document/shared?s=',
    previewPath: null,
    share: shareOf('/api/documents/:id', 'document', 'livedocuments tab'),
  },
  livedesign: {
    site: 'livedesign.app',
    noun: 'Design',
    nouns: 'Designs',
    itemPath: '/design/',
    newPath: '/new',
    offlinePath: '/offline',
    onIndex: true,
    sharePath: '/design/shared?s=',
    previewPath: '/api/designs/:id/thumbnail',
    share: shareOf('/api/designs/:id', 'design', 'livedesign tab'),
  },
};

export const APP_NAMES = Object.keys(APP_ITEMS) as AppName[];

export const isAppName = (value: unknown): value is AppName =>
  typeof value === 'string' && Object.hasOwn(APP_ITEMS, value);

/** An app's site row. */
export function siteOfApp(app: AppName): Site {
  const id = APP_ITEMS[app].site;
  return APP_SITES.find((s) => s.id === id) ?? PLATFORM_SITE;
}

/** The app a site serves, or null for liveworkspace itself. */
export function appOfSite(id: SiteId): AppName | null {
  return APP_NAMES.find((app) => APP_ITEMS[app].site === id) ?? null;
}

// The Explorer's address on liveworkspace.app, and the query that names the app a visitor came from, so its header
// shows that app's logo and its lists open filtered to it.
export const EXPLORER_PATH = '/explorer';
export const EXPLORER_FROM_PARAM = 'from';

/** The liveworkspace Explorer, at `path` under /explorer (`''` for Home), opened from `from`. `search` and `hash`
 *  are kept as given (with or without their `?` and `#`), so a redirect keeps the whole address. */
export function explorerUrl(
  from: AppName | null,
  path = '',
  search = '',
  hash = '',
  origin = PLATFORM_SITE.url,
): string {
  const tail = path.replace(/^\/+/, '');
  const params = new URLSearchParams(search.replace(/^\?/, ''));
  if (from) params.set(EXPLORER_FROM_PARAM, from);
  else params.delete(EXPLORER_FROM_PARAM);
  const query = params.toString();
  const fragment = hash.replace(/^#/, '');
  return `${origin}${EXPLORER_PATH}${tail ? `/${tail}` : ''}${query ? `?${query}` : ''}${
    fragment ? `#${fragment}` : ''
  }`;
}

// ---------- An app's old /explorer, sent to liveworkspace's ----------------------------------------------------
// Every address under an app's old /explorer goes to the liveworkspace Explorer, keeping its path, query and hash
// and naming the app as where the person came from. The app's editor worker answers it with a 302 before any HTML
// is served; its /explorer pages' client replace covers the dev server, where that worker isn't in front.

export const OLD_EXPLORER_PATH = '/explorer';

export const isOldExplorerPath = (pathname: string): boolean =>
  pathname === OLD_EXPLORER_PATH || pathname.startsWith(`${OLD_EXPLORER_PATH}/`);

/** The liveworkspace Explorer's address for one of `app`'s old /explorer addresses. */
export function oldExplorerRedirectUrl(
  app: AppName,
  pathname: string,
  search = '',
  hash = '',
): string {
  const tail = pathname.slice(OLD_EXPLORER_PATH.length).replace(/^\/+|\/+$/g, '');
  return explorerUrl(app, tail, search, hash);
}
