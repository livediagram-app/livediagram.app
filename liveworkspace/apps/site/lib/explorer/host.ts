// What liveworkspace.app hands the shared Explorer (@liveworkspace/explorer) to be its host
// (liveworkspace/docs/site.md "The Explorer"): which app the person came from, and every app's addresses (an item,
// a share link, New, Help, the offline view), all from the sites registry (@liveworkspace/sites).

import {
  placeHash,
  type ExplorerView,
  type HelpHref,
  type ItemHref,
  type LensOption,
  type Placement,
  type ShareUrl,
} from '@liveworkspace/explorer';
import type { App } from '@liveworkspace/index-client';
import { TEMPLATE_FAMILIES as DIAGRAM_FAMILIES } from '@livediagram/api-schema';
import { TEMPLATE_FAMILIES as PLAN_FAMILIES } from '@liveplanner/api-schema';
import {
  APP_ITEMS,
  APP_NAMES,
  APP_SITES,
  EXPLORER_FROM_PARAM,
  isAppName,
  siteOfApp,
  type AppName,
} from '@liveworkspace/sites';

// ---------- Which app the person came from -------------------------------------------------------------------

export const LAST_APP_KEY = 'liveworkspace:explorer-app';

/** The app a site's address belongs to: its origin, with or without `www.`, live or on its local port. */
export function appOfUrl(url: string | null | undefined): AppName | null {
  if (!url) return null;
  let host: string;
  try {
    host = new URL(url).host.replace(/^www\./, '');
  } catch {
    return null;
  }
  for (const app of APP_NAMES) {
    const site = APP_SITES.find((s) => s.id === APP_ITEMS[app].site);
    if (!site) continue;
    const ownHost = new URL(site.url).host.replace(/^www\./, '');
    if (host === ownHost || host === site.id) return app;
  }
  return null;
}

export type Arrival = {
  // The app whose logo the header shows, whose items the lists open filtered to, and whose kind New makes.
  app: AppName | null;
  // How it was decided: `?from=`, the referrer, or the last app this browser used.
  via: 'from' | 'referrer' | 'last' | null;
};

/** `?from=<app>` (set by the apps' links and redirects), then the referrer, then the last app this browser used. */
export function arrival(search: string, referrer: string, lastApp: string | null): Arrival {
  const from = new URLSearchParams(search).get(EXPLORER_FROM_PARAM);
  if (isAppName(from)) return { app: from, via: 'from' };
  const referred = appOfUrl(referrer);
  if (referred) return { app: referred, via: 'referrer' };
  if (isAppName(lastApp)) return { app: lastApp, via: 'last' };
  return { app: null, via: null };
}

export function readLastApp(): string | null {
  try {
    return localStorage.getItem(LAST_APP_KEY);
  } catch {
    return null;
  }
}

export function rememberApp(app: AppName) {
  try {
    localStorage.setItem(LAST_APP_KEY, app);
  } catch {
    // A convenience only.
  }
}

// ---------- Every app's addresses ----------------------------------------------------------------------------

const appUrl = (app: App) => siteOfApp(app).url;

/** An item, in its own app: its share code when the person reaches it through a link, and the place an Inbox row
 *  points at (`#t=<tab>&el=<element>&open=…`, or a card's `&item=`: the editors' deep link, `placeHash`). */
export const itemHref: ItemHref = (item, at) => {
  const query = item.sharedVia ? `?s=${encodeURIComponent(item.sharedVia)}` : '';
  const pin = placeHash(at);
  return `${appUrl(item.app)}${APP_ITEMS[item.app].itemPath}${encodeURIComponent(item.id)}${query}${pin}`;
};

/** A share link opens in the item's app, at the address whose page head names the item. */
export const shareUrl: ShareUrl = (link, item) =>
  `${appUrl(item.app)}${APP_ITEMS[item.app].sharePath}${encodeURIComponent(link.code)}`;

/** New: the app's own New flow, filed where the person pressed it. */
export function newItemHref(app: App, placement: Placement | null): string {
  const params = new URLSearchParams();
  if (placement?.folderId) params.set('folder', placement.folderId);
  if (placement?.teamId) params.set('team', placement.teamId);
  const query = params.toString();
  return `${appUrl(app)}${APP_ITEMS[app].newPath}${query ? `?${query}` : ''}`;
}

/** The app's view of what it keeps only in this browser, or null when it has none. */
export function offlineHref(app: App): string | null {
  const path = APP_ITEMS[app].offlinePath;
  return path ? `${appUrl(app)}${path}` : null;
}

// Each view's Help article, in the app's own help centre (every app's has the Explorer's articles).
const VIEW_HELP: Record<ExplorerView['kind'], string> = {
  home: 'explorer/home',
  all: 'explorer/my-work',
  folder: 'explorer/folders',
  team: 'explorer/team-spaces',
  unsorted: 'explorer/unsorted',
  recent: 'explorer/recent',
  favourites: 'explorer/explorer-page',
  shared: 'explorer/shared-with-you',
  inbox: 'explorer/activity',
  timeline: 'explorer/timeline',
  trash: 'account-and-data/trash',
  search: 'explorer/filters',
};
// Home has its own article in liveplanner's help centre; the others' cover it in the Explorer page's.
const HOME_ARTICLE: Partial<Record<App, string>> = { liveplanner: 'explorer/home' };

export function helpHrefFor(app: App): HelpHref {
  return (view) => {
    const slug =
      view.kind === 'home' ? (HOME_ARTICLE[app] ?? 'explorer/explorer-page') : VIEW_HELP[view.kind];
    return `${appUrl(app)}/help/${slug}/`;
  };
}

// ---------- The filter lens's Template chip ----------------------------------------------------------------------

const FAMILY_LABELS: Record<string, string> = { retrospective: 'Retrospective', kanban: 'Kanban' };
const familiesOf = (families: readonly string[]): LensOption[] =>
  families.map((value) => ({ value, label: FAMILY_LABELS[value] ?? value }));

// The template families each app files its items' intents under (its api-schema's TEMPLATE_FAMILIES), for the
// lens's Template chip. An app with none has no chip.
const LENS_TEMPLATES: Partial<Record<App, readonly LensOption[]>> = {
  livediagram: familiesOf(DIAGRAM_FAMILIES),
  liveplanner: familiesOf(PLAN_FAMILIES),
};

export function lensTemplatesFor(app: App): readonly LensOption[] | undefined {
  return LENS_TEMPLATES[app];
}

// ---------- Settings, asked for on the Explorer's address ------------------------------------------------------

export const NOTIFICATIONS_SETTINGS = '/account/settings#notifications';

/** Where `?settings=<category>` (the apps' old Settings deep link: notification emails, the account menu) goes on
 *  liveworkspace.app: the account's own categories to their place in Settings, and an app's own (its editor,
 *  say) to that app's settings dialog there. Null when the address names no settings. */
export function settingsTarget(search: string, app: AppName | null): string | null {
  const category = new URLSearchParams(search).get('settings');
  if (!category) return null;
  switch (category) {
    case 'notifications':
      return NOTIFICATIONS_SETTINGS;
    case 'account':
    case 'profile':
      return '/account/settings#profile';
    case 'tokens':
      return '/account/tokens';
    case 'teams':
      return '/account/teams';
    case 'privacy':
      return '/account/settings#privacy';
    default:
      return app ? `/account/settings?app=${app}` : '/account/settings#apps';
  }
}

// ---------- Why the person was sent here ----------------------------------------------------------------------

export const ENDED_PARAM = 'ended';

/** `?ended=revoked`, set by an editor whose share link was revoked under it: the toast that explains the arrival. */
export function arrivalNotice(search: string, app: AppName | null): string | null {
  if (new URLSearchParams(search).get(ENDED_PARAM) !== 'revoked') return null;
  const noun = app ? APP_ITEMS[app].noun.toLowerCase() : 'item';
  return `The link you opened that ${noun} with was revoked, so it is no longer open to you.`;
}

// ---------- Retired addresses --------------------------------------------------------------------------------

// Explorer addresses that no longer have a view of their own, kept so links already out there (and every
// notification email's unsubscribe link) land somewhere real. Each replaces itself with its successor.
export const RETIRED_TARGETS = {
  dynamic: '/explorer/all',
  generated: '/explorer/search?q=made-by%3Aai',
  activity: '/explorer/inbox',
  tags: '/explorer',
  // Notification switches are the account's: Settings › Notifications on liveworkspace.app. Every notification
  // email ever sent carries this address (or `?settings=notifications`) as its unsubscribe link.
  profile: NOTIFICATIONS_SETTINGS,
  // Team invitations are answered on the account's Teams page.
  invites: '/account/teams',
} as const;

export type RetiredView = keyof typeof RETIRED_TARGETS;

/** A retired address's successor, keeping `?from=` so the Explorer still knows the app. */
export function retiredTarget(view: RetiredView, search: string): string {
  const target = RETIRED_TARGETS[view];
  const from = new URLSearchParams(search).get(EXPLORER_FROM_PARAM);
  if (!isAppName(from) || !target.startsWith('/explorer')) return target;
  const [path, query = ''] = target.split('?');
  const params = new URLSearchParams(query);
  params.set(EXPLORER_FROM_PARAM, from);
  return `${path}?${params}`;
}
