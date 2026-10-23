// The settings page's catalogue (liveworkspace/docs/site.md "Your account", accounts.md "Settings"):
// the settings in the `all` scope that mean something without an editor, worded as the apps' own
// Settings word them (livediagram's settings-catalogue.ts), so a switch reads the same here as in
// any app. The editors' chrome (UI scale, panel opacity and the rest) is left out: it means nothing
// without an editor, and each app shows it in its own Settings.
import { ALL_SETTING_KEYS, type AllSettingKey } from '@liveworkspace/settings';
import { APP_SITES, type SiteId } from '@liveworkspace/sites';

export type SettingsBlob = Record<string, unknown>;

export interface ToggleRow {
  key: AllSettingKey;
  label: string;
  description: string;
  // What an unset key means: the apps read most switches as on unless turned off.
  fallback: boolean;
}

export interface ToggleSection {
  id: string;
  title: string;
  hint: string;
  rows: ToggleRow[];
}

const on = (key: AllSettingKey, label: string, description: string): ToggleRow => ({
  key,
  label,
  description,
  fallback: true,
});

export const NOTIFICATION_ROWS: ToggleRow[] = [
  on(
    'notifyComments',
    'Someone Comments on My Work',
    'Someone leaves a comment on a diagram, plan, document or design you own.',
  ),
  on(
    'notifyMentions',
    'Someone Mentions Me in a Comment',
    'A teammate @mentions you in a comment.',
  ),
  on(
    'notifyActionAssigned',
    'Someone Assigns Me an Action',
    'A teammate assigns you an action on an element.',
  ),
  on(
    'notifyInviteResponse',
    'Someone Responds to a Team Invite',
    'Someone you invited accepts or declines, for teams you are an admin of.',
  ),
  on(
    'notifyTips',
    'Tips and Check-Ins',
    'Occasional getting-started tips, and a nudge if you have been away a while.',
  ),
  on(
    'notifyMilestones',
    'Milestones',
    'A note when you hit one, like sharing your first piece of work.',
  ),
];

export const IN_APP_ROWS: ToggleRow[] = [
  on(
    'notificationsEnabled',
    'In-Editor Notifications',
    'A brief note when something happens off screen, like moving something to a folder. Errors and warnings always show.',
  ),
];

export const PRIVACY_ROWS: ToggleRow[] = [
  on(
    'telemetryEnabled',
    'Send Anonymous Usage Events',
    'Small first-party events, listed publicly on /telemetry, that show which features help. Never your content, no third-party trackers.',
  ),
  {
    key: 'reduceMotion',
    label: 'Reduce Motion',
    description:
      'Turns off the apps’ animations and transitions on every device you use. Your device’s own setting is always respected too.',
    fallback: false,
  },
];

// The page's switches, by card.
export const TOGGLE_SECTIONS: ToggleSection[] = [
  {
    id: 'notifications',
    title: 'Notifications',
    hint: 'Which emails we send you, and the notes the apps show while you work. Each holds in every app.',
    rows: [...NOTIFICATION_ROWS, ...IN_APP_ROWS],
  },
  {
    id: 'privacy',
    title: 'Privacy and accessibility',
    hint: 'These follow you into every app, on every device you sign in on.',
    rows: PRIVACY_ROWS,
  },
];

// Shared keys this page leaves to the apps: they only mean something inside an editor.
export const EDITOR_ONLY_KEYS: readonly AllSettingKey[] = [
  'panelOpacity',
  'uiScale',
  'uiScalePanels',
  'uiScaleToolbar',
  'uiScaleCornerButtons',
  'middleMousePan',
  'dockButtonNames',
  'powerUserMode',
  'minimalChrome',
  'customSwatches',
];

// Every shared key is either on this page or deliberately left to the apps.
export function uncatalogued(): AllSettingKey[] {
  const shown = new Set<string>(TOGGLE_SECTIONS.flatMap((s) => s.rows.map((r) => r.key)));
  return ALL_SETTING_KEYS.filter((key) => !shown.has(key) && !EDITOR_ONLY_KEYS.includes(key));
}

// A switch's state from the stored scope: a boolean as stored, anything else its fallback.
export function readToggle(all: SettingsBlob, row: ToggleRow): boolean {
  const value = all[row.key];
  return typeof value === 'boolean' ? value : row.fallback;
}

// The presence colours every app offers (each app's lib/identity.ts PARTICIPANT_COLORS), in the
// apps' order: the colours collaborators see on your cursor, comments and avatar. Dark mode paints
// each one's 700 step under white text (@livediagram/ui identityVars).
export const PRESENCE_COLOURS: readonly { value: string; name: string }[] = [
  { value: '#0ea5e9', name: 'Sky' },
  { value: '#10b981', name: 'Emerald' },
  { value: '#f59e0b', name: 'Amber' },
  { value: '#ef4444', name: 'Red' },
  { value: '#8b5cf6', name: 'Violet' },
  { value: '#ec4899', name: 'Pink' },
  { value: '#14b8a6', name: 'Teal' },
  { value: '#f97316', name: 'Orange' },
  { value: '#6366f1', name: 'Indigo' },
  { value: '#84cc16', name: 'Lime' },
];

// A colour's name for the page, or "Custom" for one set elsewhere that isn't in the palette.
export function colourName(color: string | null): string {
  if (!color) return 'Automatic';
  return PRESENCE_COLOURS.find((c) => c.value === color.toLowerCase())?.name ?? 'Custom';
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

// Each app's own Settings, opened by its `?settings=<category>` deep link on its Explorer, the same
// link its emails use. Every app's Settings opens on its Editor category.
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
    href: `${site.url}/explorer?settings=editor`,
  }));
}
