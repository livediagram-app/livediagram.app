// Home's first run on liveworkspace.app: the starting points of the app the person came from, from that app's
// welcome manifest (`@<app>/templates/welcome.json`, generated from its templates). Loaded only when Home finds a
// first run, each app's in a chunk of its own, and every address made absolute in that app, so a start makes its
// item there.

import type { WelcomeManifest, WelcomeStart } from '@liveworkspace/explorer';
import { siteOfApp, type AppName } from '@liveworkspace/sites';

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

const FILES: Record<AppName, () => Promise<{ default: unknown }>> = {
  livediagram: () => import('@livediagram/templates/welcome.json'),
  liveplanner: () => import('@liveplanner/templates/welcome.json'),
  livedocuments: () => import('@livedocuments/templates/welcome.json'),
  livedesign: () => import('@livedesign/templates/welcome.json'),
};

/** A file's addresses, made the app's own. */
export function absoluteWelcome(app: AppName, file: WelcomeFile): WelcomeManifest {
  const site = siteOfApp(app);
  const at = (href: string) => (/^https?:/.test(href) ? href : `${site.url}${href}`);
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
  let pending = loaded.get(app);
  if (!pending) {
    pending = FILES[app]()
      .then((m) => absoluteWelcome(app, m.default as WelcomeFile))
      .catch(() => {
        loaded.delete(app);
        return null;
      });
    loaded.set(app, pending);
  }
  return pending;
}
