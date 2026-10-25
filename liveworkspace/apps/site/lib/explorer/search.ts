// The Search panel's own entries on the Explorer (liveworkspace/docs/site.md "The Explorer", Search): the
// Explorer's help articles in the app's help centre, and, signed in, the sections of the Settings panel.
// Loaded with the panel (components/explorer/ExplorerSearch.tsx), never with the page.

import type { SearchEntry } from '@liveworkspace/explorer/search-panel';
import { APP_NAMES, siteOfApp, type AppName } from '@liveworkspace/sites';
import { SETTINGS_CONTENTS } from '@/lib/account-settings';
import { appOrigin, workspaceHref } from './page-app';

// The Explorer's articles every app's help centre has (lib/explorer/host.ts VIEW_HELP), by name.
const HELP_ARTICLES: readonly { slug: string; label: string }[] = [
  { slug: 'explorer/explorer-page', label: 'The Explorer' },
  { slug: 'explorer/my-work', label: 'My Work' },
  { slug: 'explorer/folders', label: 'Folders' },
  { slug: 'explorer/team-spaces', label: 'Team Spaces' },
  { slug: 'explorer/recent', label: 'Recent' },
  { slug: 'explorer/shared-with-you', label: 'Shared With You' },
  { slug: 'explorer/activity', label: 'Activity and the Inbox' },
  { slug: 'explorer/timeline', label: 'The Timeline' },
  { slug: 'explorer/filters', label: 'Filters and Search' },
  { slug: 'account-and-data/trash', label: 'The Trash' },
  { slug: 'getting-started/guest-vs-account', label: 'Guest or Account' },
];

// The Account sections that need liveworkspace.app's own session.
const SESSION_SECTIONS = new Set(['profile', 'tokens']);

export function searchEntries(app: AppName, signedIn: boolean): SearchEntry[] {
  const site = siteOfApp(app);
  const help: SearchEntry[] = HELP_ARTICLES.map(({ slug, label }) => ({
    id: slug,
    group: 'help',
    label,
    hint: `${site.name} Help`,
    href: `${appOrigin(app)}/help/${slug}/`,
    newTab: true,
  }));
  if (!signedIn) return help;
  // Each opens the Settings panel here, in place, on its section (`?settings=`); the profile and the API tokens are
  // liveworkspace.app's session's, so from an app's address they open the panel there.
  const account: SearchEntry[] = SETTINGS_CONTENTS.map(({ id, title }) => ({
    id,
    group: 'settings',
    label: title,
    hint: 'Account Settings',
    href: SESSION_SECTIONS.has(id)
      ? workspaceHref(`/explorer?settings=${id}`)
      : `/explorer?settings=${id}`,
  }));
  // Each app's own settings, in the Settings panel filtered to that app.
  const apps: SearchEntry[] = APP_NAMES.map((name) => ({
    id: `app:${name}`,
    group: 'settings',
    label: `${siteOfApp(name).name} Settings`,
    hint: 'Settings',
    href: `/explorer?settings=${name}`,
  }));
  return [...help, ...account, ...apps];
}
