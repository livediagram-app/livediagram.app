// Home's hero art on liveworkspace.app: the picture of the app the person came from, from that app's hero manifest
// (`@<app>/templates/hero.json`, generated from the components its own Home draws). An app that ships none shows
// no art. Each app's in a chunk of its own, loaded once per page and only where the hero has room for art (from
// `lg` up), so a phone never fetches it.

import type { HeroArtManifest } from '@liveworkspace/explorer';
import type { AppName } from '@liveworkspace/sites';

const FILES: Partial<Record<AppName, () => Promise<{ default: unknown }>>> = {
  livediagram: () => import('@livediagram/templates/hero.json'),
  liveplanner: () => import('@liveplanner/templates/hero.json'),
  livedocuments: () => import('@livedocuments/templates/hero.json'),
  livedesign: () => import('@livedesign/templates/hero.json'),
};

/** Whether a file is a manifest the Explorer can draw. */
export function isHeroArt(file: unknown): file is HeroArtManifest {
  const m = file as HeroArtManifest | null;
  return (
    !!m &&
    typeof m.label === 'string' &&
    Array.isArray(m.sheets) &&
    m.sheets.length > 0 &&
    m.sheets.every((s) => typeof s.id === 'string' && typeof s.label === 'string')
  );
}

const loaded = new Map<AppName, Promise<HeroArtManifest | null>>();

/** The app's hero art, or null when it ships none; loaded once per page. */
export function loadHeroArt(app: AppName): Promise<HeroArtManifest | null> {
  const file = FILES[app];
  if (!file) return Promise.resolve(null);
  let pending = loaded.get(app);
  if (!pending) {
    pending = file()
      .then((m) => (isHeroArt(m.default) ? m.default : null))
      .catch(() => {
        loaded.delete(app);
        return null;
      });
    loaded.set(app, pending);
  }
  return pending;
}

/** Whether the hero has room for art: Home draws it from `lg` (64rem) up. */
export function heroHasRoom(): boolean {
  return (
    typeof window !== 'undefined' && window.matchMedia?.('(min-width: 64rem)').matches === true
  );
}
