// Home's first run (docs/specs/013-workspace/explorer-home.md "First run"): livedesign's starting points for the shared
// Explorer's welcome, from the templates package's manifest (`@livedesign/templates/welcome.json`, generated from the
// templates). Loaded only when Home finds a first run, in a chunk of its own; every address is this site's.
import type { WelcomeManifest, WelcomeStart } from '@liveworkspace/explorer';

type WelcomeFile = {
  pillFree: string;
  startBlankHref: string;
  allTemplatesHref: string;
  searchHref: string;
  fan: string[];
  blanks: WelcomeStart[];
  popular: WelcomeStart[];
};

export function welcomeManifest(file: WelcomeFile): WelcomeManifest {
  return {
    name: 'livedesign',
    pillFree: file.pillFree,
    blanks: file.blanks,
    popular: file.popular,
    fan: file.fan,
    startBlankHref: file.startBlankHref,
    allTemplatesHref: file.allTemplatesHref,
    searchHref: (words) => `${file.searchHref}${encodeURIComponent(words)}`,
  };
}

let loading: Promise<WelcomeManifest | null> | null = null;

/** The welcome, loaded once per page; null when its chunk fails (Home then shows its empty sections). */
export function loadWelcome(): Promise<WelcomeManifest | null> {
  loading ??= import('@livedesign/templates/welcome.json')
    .then((m) => welcomeManifest(m.default as WelcomeFile))
    .catch(() => {
      loading = null;
      return null;
    });
  return loading;
}
