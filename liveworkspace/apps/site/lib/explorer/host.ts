// What liveworkspace.app hands the shared Explorer (@liveworkspace/explorer) to be its host
// (liveworkspace/docs/specs/010-site/site.md "The Explorer"): which app the person came from, and every app's addresses (an item,
// a share link, New, Help, the offline view), all from the sites registry (@liveworkspace/sites).

import {
  placeHash,
  type DefaultFolderOption,
  type ExplorerView,
  type HelpHref,
  type ItemHref,
  type LensOption,
  type Placement,
  type ShareUrl,
} from '@liveworkspace/explorer';
import type { App } from '@liveworkspace/index-client';
import {
  DEFAULT_FOLDER_OPTIONS as DIAGRAM_FOLDER_OPTIONS,
  LENS_MODES as DIAGRAM_MODES,
  TEMPLATE_FAMILIES as DIAGRAM_FAMILIES,
} from '@livediagram/api-schema';
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
import { appOrigin } from './page-app';

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
  // How it was decided: `?from=` or the referrer; `host` on an app's own address.
  via: 'from' | 'referrer' | 'host' | null;
};

/** `?from=<app>` (set by the apps' links and redirects), then the referrer. Anyone else is in no app: on
 *  liveworkspace.app they see every app's work (liveworkspace/docs/specs/010-site/site.md "The Explorer", Which app). */
export function arrival(search: string, referrer: string): Arrival {
  const from = new URLSearchParams(search).get(EXPLORER_FROM_PARAM);
  if (isAppName(from)) return { app: from, via: 'from' };
  const referred = appOfUrl(referrer);
  if (referred) return { app: referred, via: 'referrer' };
  return { app: null, via: null };
}

/** The last app this browser came from: what New makes, and whose welcome and hero Home shows, in no app. It never
 *  filters the lists. */
export function readLastApp(): AppName | null {
  try {
    const last = localStorage.getItem(LAST_APP_KEY);
    return isAppName(last) ? last : null;
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

// Where the person works on an item: on an app's own address, that app's own origin (the page's), so its links stay
// there; anywhere else, the app's site.
const appUrl = (app: App) => appOrigin(app);
// What is handed to other people (a share link): always the app's own site.
const publicUrl = (app: App) => siteOfApp(app).url;

/** An item, in its own app: its share code when the person reaches it through a link, and the place an Inbox row
 *  points at (`#t=<tab>&el=<element>&open=…`, or a card's `&item=`: the editors' deep link, `placeHash`). */
export const itemHref: ItemHref = (item, at) => {
  const query = item.sharedVia ? `?s=${encodeURIComponent(item.sharedVia)}` : '';
  const pin = placeHash(at);
  return `${appUrl(item.app)}${APP_ITEMS[item.app].itemPath}${encodeURIComponent(item.id)}${query}${pin}`;
};

/** A share link opens in the item's app, at the address whose page head names the item. */
export const shareUrl: ShareUrl = (link, item) =>
  `${publicUrl(item.app)}${APP_ITEMS[item.app].sharePath}${encodeURIComponent(link.code)}`;

/** New: the app's own New flow, filed where the person pressed it. */
export function newItemHref(app: App, placement: Placement | null): string {
  const params = new URLSearchParams();
  if (placement?.folderId) params.set('folder', placement.folderId);
  if (placement?.teamId) params.set('team', placement.teamId);
  const query = params.toString();
  return `${appUrl(app)}${APP_ITEMS[app].newPath}${query ? `?${query}` : ''}`;
}

/** A kind of work on Home's hero: the app's New flow with the template that starts it (`?template=`, the address its
 *  welcome uses), in that app. */
export function templateHref(app: App, template: string): string {
  return `${appUrl(app)}${APP_ITEMS[app].newPath}?template=${encodeURIComponent(template)}`;
}

/** The app's view of what it keeps only in this browser: This Browser in the Explorer on the app's address
 *  (`offlinePath`, `/explorer/offline`), which can read the app's list (one-explorer.md "This Browser"). Null for an
 *  app that keeps nothing there. */
export function offlineHref(app: App): string | null {
  const path = APP_ITEMS[app].offlinePath;
  return path ? `${appUrl(app)}${path}` : null;
}

// Each view's Help article, in the app's own help centre (every app's has the Explorer's articles).
// A view with no article (Invites) shows no Help button.
const VIEW_HELP: Partial<Record<ExplorerView['kind'], string>> = {
  home: 'explorer/home',
  all: 'explorer/my-work',
  folder: 'explorer/folders',
  team: 'explorer/team-spaces',
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
    return slug ? `${appUrl(app)}/help/${slug}/` : undefined;
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

// The editor modes an app's items open in, for the lens's Mode chip (an item's `summary.mode`): only an app with more
// than one. livediagram's Diagram, Draw and Workshop; every other app's items open in one mode, so no chip.
const LENS_MODES: Partial<Record<App, readonly LensOption[]>> = {
  livediagram: DIAGRAM_MODES,
};

export function lensModesFor(app: App): readonly LensOption[] | undefined {
  return LENS_MODES[app];
}

// Default Folders' entries per editor mode and specific kind, for an app that files new items by them (its
// api-schema's DEFAULT_FOLDER_OPTIONS), between the app's own entry and its template families.
const DEFAULT_FOLDER_OPTIONS: Partial<Record<App, readonly DefaultFolderOption[]>> = {
  livediagram: DIAGRAM_FOLDER_OPTIONS,
};

export function defaultFolderOptionsFor(app: App): readonly DefaultFolderOption[] | undefined {
  return DEFAULT_FOLDER_OPTIONS[app];
}

// ---------- Settings, asked for on the Explorer's address ------------------------------------------------------

/** `?settings=<section>`: the Settings panel's own address (liveworkspace/docs/specs/010-site/site.md "Settings", Addresses). */
export const SETTINGS_PARAM = 'settings';
/** A section of the category `?settings=` opens, to scroll to (`?settings=profile&section=cloud-sync`). */
export const SECTION_PARAM = 'section';

/** The account's notification settings: every notification email's unsubscribe link lands here. */
export const NOTIFICATIONS_SETTINGS = `/explorer?${SETTINGS_PARAM}=notifications`;

// The Account section's categories an address can name, by the panel's own category ids (the profile's is `account`).
const ACCOUNT_CATEGORIES: Readonly<Record<string, string>> = {
  account: 'account',
  profile: 'account',
  notifications: 'notifications',
  tokens: 'tokens',
  privacy: 'privacy',
  accessibility: 'accessibility',
};

/** Where the Settings panel opens: the app it is opened for (its side of the switch), the side (`all`, `app`, or null
 *  for this browser's last), and the category, by its id in All (`account:notifications`). */
export type SettingsOpening = {
  app: AppName | null;
  scope: 'app' | 'all' | null;
  categoryId: string | null;
};

/** What `?settings=<section>` asks for, the panel opened in place over the Explorer (notification emails, the old
 *  `/account/settings`, an editor's account menu): an Account category on All, `all` on All, an app's name on that
 *  app's side, and anything else (an editor's own category) on the side of the app the person came from. `teams` is
 *  the Invites, beside the teams. Null when it names nothing. */
export function settingsOpening(
  section: string | null,
  app: AppName | null,
): SettingsOpening | 'teams' | null {
  if (!section) return null;
  if (section === 'teams') return 'teams';
  const account = ACCOUNT_CATEGORIES[section];
  // The panel files the Account section's categories under its heading (settings-ui groupedId).
  if (account) return { app, scope: 'all', categoryId: `account:${account}` };
  if (section === 'all' || section === 'apps') return { app, scope: 'all', categoryId: null };
  const named = section.toLowerCase();
  if (isAppName(named)) return { app: named, scope: 'app', categoryId: null };
  return app
    ? { app, scope: 'app', categoryId: null }
    : { app: null, scope: 'all', categoryId: null };
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
  // My Work's root already lists what is in no folder.
  unsorted: '/explorer/all',
  generated: '/explorer/search?q=made-by%3Aai',
  activity: '/explorer/inbox',
  tags: '/explorer',
  // Notification switches are the account's: the Settings panel on Notifications, opened in place. Every
  // notification email ever sent carries this address (or `?settings=notifications`) as its unsubscribe link.
  profile: NOTIFICATIONS_SETTINGS,
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
