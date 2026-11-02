// Home's first run on liveworkspace.app: the starting points of the app the person came from, from that app's
// welcome manifest (`@<app>/templates/welcome.json`, generated from its templates). Loaded only when Home finds a
// first run, each app's in a chunk of its own, and every address made absolute in that app, so a start makes its
// item there.

import type { WelcomeManifest, WelcomeStart } from '@liveworkspace/explorer';
import { APP_NAMES, PLATFORM_SITE, siteOfApp, type AppName } from '@liveworkspace/sites';
import { appOrigin } from './page-app';

/** A manifest as the templates package writes it: addresses relative to the app. */
export type WelcomeFile = {
  app: string;
  pillFree: string;
  startBlankHref: string;
  allTemplatesHref: string;
  searchHref: string;
  fan: string[];
  blanks: WelcomeStart[];
  popular: WelcomeStart[];
};

// A held app (livehuddle) has none until its fork brings its templates; no Explorer lists it before then.
const FILES: Partial<Record<AppName, () => Promise<{ default: unknown }>>> = {
  livediagram: () => import('@livediagram/templates/welcome.json'),
  liveplanner: () => import('@liveplanner/templates/welcome.json'),
  livedocuments: () => import('@livedocuments/templates/welcome.json'),
  livedesign: () => import('@livedesign/templates/welcome.json'),
};

/** A file's addresses, made the app's own. */
export function absoluteWelcome(app: AppName, file: WelcomeFile): WelcomeManifest {
  const site = siteOfApp(app);
  const origin = appOrigin(app);
  const at = (href: string) => (/^https?:/.test(href) ? href : `${origin}${href}`);
  const start = (s: WelcomeStart): WelcomeStart => ({ ...s, href: at(s.href) });
  return {
    name: site.name,
    pillFree: file.pillFree,
    blanks: file.blanks.map(start),
    popular: file.popular.map(start),
    fan: file.fan,
    startBlankHref: at(file.startBlankHref),
    allTemplatesHref: at(file.allTemplatesHref),
    searchHref: (words) => at(`${file.searchHref}${encodeURIComponent(words)}`),
  };
}

const loaded = new Map<AppName, Promise<WelcomeManifest | null>>();

/** The app's welcome, loaded once per page. */
export function loadWelcome(app: AppName): Promise<WelcomeManifest | null> {
  const file = FILES[app];
  if (!file) return Promise.resolve(null);
  let pending = loaded.get(app);
  if (!pending) {
    pending = file()
      .then((m) => absoluteWelcome(app, m.default as WelcomeFile))
      .catch(() => {
        loaded.delete(app);
        return null;
      });
    loaded.set(app, pending);
  }
  return pending;
}

// How many popular starts the platform's welcome shows: about one app's worth.
const PLATFORM_POPULAR = 8;

/** liveworkspace.app's own welcome, for a person in no app: one blank from each app (none whose name two apps share,
 *  so each says which app it makes), the apps' popular starts taken in turn, and a fan from the first three apps.
 *  The wizard, search and template links stay `home`'s, the app New makes. Each start's id carries its app. */
export function platformWelcome(
  apps: readonly { app: AppName; manifest: WelcomeManifest }[],
  home: WelcomeManifest,
): WelcomeManifest {
  const tag = (app: AppName, s: WelcomeStart): WelcomeStart => ({ ...s, id: `${app}:${s.id}` });
  const names = new Map<string, number>();
  for (const { manifest } of apps)
    for (const b of new Set(manifest.blanks.map((x) => x.name)))
      names.set(b, (names.get(b) ?? 0) + 1);
  const blanks = apps.flatMap(({ app, manifest }) => {
    const own = manifest.blanks.find((b) => names.get(b.name) === 1) ?? manifest.blanks[0];
    return own ? [tag(app, own)] : [];
  });
  const popular: WelcomeStart[] = [];
  for (let i = 0; popular.length < PLATFORM_POPULAR; i++) {
    const round = apps.flatMap(({ app, manifest }) =>
      manifest.popular[i] ? [tag(app, manifest.popular[i]!)] : [],
    );
    if (!round.length) break;
    popular.push(...round.slice(0, PLATFORM_POPULAR - popular.length));
  }
  const fan = apps
    .flatMap(({ app, manifest }) => (manifest.fan[0] ? [`${app}:${manifest.fan[0]}`] : []))
    .slice(0, 3);
  return { ...home, name: PLATFORM_SITE.name, blanks, popular, fan };
}

let platform: Promise<WelcomeManifest | null> | null = null;

/** liveworkspace.app's welcome in no app, every app's manifest loaded once per page (each its own chunk). */
export function loadPlatformWelcome(home: AppName): Promise<WelcomeManifest | null> {
  platform ??= Promise.all(
    APP_NAMES.map((app) =>
      loadWelcome(app).then((manifest) => (manifest ? { app, manifest } : null)),
    ),
  ).then((all) => {
    const apps = all.filter((x): x is { app: AppName; manifest: WelcomeManifest } => x !== null);
    const own = apps.find((a) => a.app === home)?.manifest;
    if (!own) {
      platform = null;
      return null;
    }
    return platformWelcome(apps, own);
  });
  return platform;
}
