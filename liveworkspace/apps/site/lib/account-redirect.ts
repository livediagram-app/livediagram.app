// The old account pages (liveworkspace/docs/specs/010-site/site.md "Your account"): `/account`, `/account/settings…` and
// `/account/tokens` are no longer pages, but emails and bookmarks carry them, so each sends the browser on to the
// Explorer with the Settings panel open on the same section (`?settings=`, lib/explorer/host.ts settingsOpening).
// Kept light: the page that runs it is a one-line hop, so it imports the sites registry alone, not the panel.
import { APP_SITES } from '@liveworkspace/sites';

// The Account section's categories an old address named by its anchor (`#notifications`, every email's unsubscribe).
const ANCHORS = new Set(['profile', 'notifications', 'privacy', 'accessibility', 'tokens']);

/** Where an old account address goes: `/explorer?settings=<section>`. */
export function accountRedirect(pathname: string, search: string, hash: string): string {
  const to = (section: string) => `/explorer?settings=${encodeURIComponent(section)}`;
  if (pathname.replace(/\/+$/, '') === '/account/tokens') return to('tokens');
  const anchor = hash.replace(/^#/, '');
  if (ANCHORS.has(anchor)) return to(anchor);
  // `?app=` named an app by its site (`livedesign.app`) or its name (`livedesign`).
  const param = new URLSearchParams(search).get('app')?.toLowerCase();
  const site = param ? APP_SITES.find((s) => s.id === param || s.name === param) : undefined;
  return to(site?.name ?? 'all');
}
