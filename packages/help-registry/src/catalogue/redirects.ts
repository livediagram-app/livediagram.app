// The help paths that moved (liveworkspace/docs/specs/016-help/help-centre.md "Every old help path keeps working"):
// each old path answers 308 to its new one on the same address, before anything else, so a link people already
// shared keeps landing. The help Worker reads them from the build's manifest (apps/help scripts/build-scopes.mjs).
//
// Paths have no `/help` prefix and no slashes at either end; `to` empty is the help home, a `to` may carry a
// `#fragment`, and an absolute `to` (https://...) leaves the help centre (the policies live on liveworkspace.app). `apps` limits a redirect to
// those apps' addresses (one app retired a path another still has); without it, it holds on every address. A `from`
// ending in `/*` holds for everything under it too. Merge agents append the paths merging moved or retired.

import type { AppId } from '../apps';

export interface HelpRedirect {
  from: string;
  to: string;
  apps?: readonly AppId[];
}

export const HELP_REDIRECTS: readonly HelpRedirect[] = [
  // The moved pages each product's help kept as a noindex stub (@liveworkspace/help-site lib/moved.ts).
  { from: 'explorer/my-work', to: 'explorer/personal-space' },
  { from: 'explorer/unsorted', to: 'explorer/personal-space' },
  {
    from: 'palette/favourites',
    to: 'palette/toolbar-layout',
    apps: ['livediagram', 'livedesign', 'livehuddle'],
  },
  {
    from: 'palette/popular',
    to: 'palette/toolbar-layout',
    apps: ['livediagram', 'livedesign', 'livehuddle'],
  },
  { from: 'user-interface/power-user-mode', to: 'user-interface/settings' },
  { from: 'tabs/add-to-project', to: 'tabs/using-tabs#tabs-in-more-than-one-plan', apps: ['liveplanner'] },
  { from: 'policies/privacy-policy', to: 'https://www.liveworkspace.app/privacy' },
  { from: 'privacy-and-security/privacy-policy', to: 'https://www.liveworkspace.app/privacy' },
  { from: 'policies/terms', to: 'https://www.liveworkspace.app/terms' },
  // The apps' retired articles (each product help app's public/_redirects until the merge).
  { from: 'explorer/timeline', to: 'explorer/home' },
  { from: 'self-hosting/*', to: '', apps: ['livedocuments', 'livedesign'] },
  { from: 'self-hosting', to: '', apps: ['livedocuments', 'livedesign'] },
  { from: 'selection-modes/slide-deck/*', to: 'selection-modes', apps: ['livedesign'] },
  { from: 'selection-modes/slide-deck', to: 'selection-modes', apps: ['livedesign'] },
  {
    from: 'selection-modes/isometric-mode',
    to: 'selection-modes',
    apps: ['livedocuments', 'livedesign'],
  },
  { from: 'canvas/layers-organising', to: 'canvas/layers', apps: ['livedocuments', 'livedesign'] },
  {
    from: 'canvas/layers-visibility-and-locking',
    to: 'canvas/layers',
    apps: ['livedocuments', 'livedesign'],
  },
  { from: 'pages/tab-windows', to: 'pages', apps: ['livedocuments', 'livedesign'] },
  { from: 'canvas/links', to: 'canvas', apps: ['livedocuments'] },
  { from: 'canvas/notes', to: 'canvas', apps: ['livedocuments'] },
  { from: 'tabs/linking-tabs', to: 'tabs', apps: ['livedocuments'] },
  // liveworkspace.app's own help pages, which the one help centre replaced (liveworkspace/docs/specs/010-site/site.md
  // "Help"): the Explorer's guide (its landing, /help/explorer, and /help/explorer/folders keep their paths here) and
  // the Google Drive article.
  { from: 'google-drive', to: 'account-and-data/google-drive' },
  { from: 'explorer/teams', to: 'collaboration/teams' },
  { from: 'explorer/sharing', to: 'collaboration/sharing' },
  { from: 'explorer/signing-in', to: 'account-and-data/signing-in' },
  { from: 'explorer/moving', to: 'explorer/folders' },
];

/** The redirect `path` (no slashes at either end) takes on `scope`'s address, or undefined. Exact paths win over
 *  prefixes. */
export function redirectFor(
  redirects: readonly HelpRedirect[],
  path: string,
  scope: AppId | 'all',
): HelpRedirect | undefined {
  const holds = (r: HelpRedirect) => !r.apps || scope === 'all' || r.apps.includes(scope);
  return (
    redirects.find((r) => holds(r) && r.from === path) ??
    redirects.find(
      (r) => holds(r) && r.from.endsWith('/*') && path.startsWith(`${r.from.slice(0, -2)}/`),
    )
  );
}
