// The account's own settings on this site (liveworkspace/docs/site.md "Settings", accounts.md "Settings"). The
// switches themselves are plain data every host of the Settings panel shares (@liveworkspace/settings/account); what
// is here is the site's side: the profile's helpers, each app's way into its editor, and the panel's sections for
// the Explorer's search.
import { PRESENCE_COLOURS, presenceColour } from '@liveworkspace/settings';
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

// The presence colours are every app's one palette (@liveworkspace/settings PRESENCE_COLOURS), each
// with its dark-mode shade: what collaborators see on your cursor, comments and avatar.
export { PRESENCE_COLOURS };

// A colour's name for the page, or "Custom" for one set elsewhere that isn't in the palette.
export function colourName(color: string | null): string {
  if (!color) return 'Automatic';
  return presenceColour(color)?.name ?? 'Custom';
}

// The display name's limit (the accounts API's PROFILE_NAME_MAX), and how long typing must pause
// before it is saved.
export const PROFILE_NAME_MAX = 120;
export const NAME_SAVE_DELAY_MS = 800;

// A name as it would be stored: trimmed, and empty meaning "no name of my own".
export function cleanName(name: string): string | null {
  const trimmed = name.trim();
  return trimmed ? trimmed : null;
}

// Each app, for what only its own Settings holds (appearance, shortcuts), which opens inside the
// editor. Its Explorer Home, not its `?settings=` deep link: the Explorer sends an app's categories
// to the Settings panel here (lib/explorer/host.ts settingsTarget), so that link would only come back.
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
// (`/account/settings#<id>`).
export const SETTINGS_CONTENTS: { id: string; title: string }[] = [
  { id: 'profile', title: 'Profile' },
  { id: 'notifications', title: 'Notifications' },
  { id: 'privacy', title: 'Privacy' },
  { id: 'accessibility', title: 'Accessibility' },
];
