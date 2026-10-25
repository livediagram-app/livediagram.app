// The account's own settings on this site (liveworkspace/docs/site.md "Settings", accounts.md "Settings"). The
// switches themselves are plain data every host of the Settings panel shares (@liveworkspace/settings/account); what
// is here is the site's side: each app's way into its editor, and the panel's sections for the Explorer's search.
// The profile's helpers are shared (@liveworkspace/settings/presence, @liveworkspace/settings-ui ProfileEditor).
import { APP_SITES, type SiteId } from '@liveworkspace/sites';

export {
  ACCESSIBILITY_ROWS,
  EDITOR_ONLY_KEYS,
  IN_APP_ROWS,
  NOTIFICATION_ROWS,
  PRIVACY_ROWS,
  readAccountToggle as readToggle,
  uncatalogued,
  type AccountToggle as ToggleRow,
} from '@liveworkspace/settings/account';

export type SettingsBlob = Record<string, unknown>;

// Each app, for what only its own Settings holds (appearance, shortcuts), which opens inside the
// editor. Its Explorer Home, not its `?settings=` deep link: the Explorer sends an app's categories
// to the Settings panel (lib/explorer/host.ts settingsOpening), so that link would only come back.
export interface AppSettingsLink {
  id: SiteId;
  name: string;
  pitch: string;
  href: string;
}

export function appSettingsLinks(): AppSettingsLink[] {
  return APP_SITES.map((site) => ({
    id: site.id,
    name: site.name,
    pitch: site.pitch,
    href: `${site.url}/explorer/home`,
  }));
}

// The Account section's categories in the Settings panel, for the Explorer's search: each opens the panel there
// (`/explorer?settings=<id>`).
export const SETTINGS_CONTENTS: { id: string; title: string }[] = [
  { id: 'profile', title: 'Profile' },
  { id: 'notifications', title: 'Notifications' },
  { id: 'tokens', title: 'API Tokens' },
  { id: 'privacy', title: 'Privacy' },
  { id: 'accessibility', title: 'Accessibility' },
];
