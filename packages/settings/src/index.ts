// Which of a person's settings every app shares (liveworkspace/docs/accounts.md "Settings"). The
// accounts database keeps two rows per person: the `all` scope, which every app reads and shows,
// and one per app. A key listed here lives in `all`, so changing it in one app changes it in every
// app that has it; any other key is the app's own. An app shows only the settings it has, so a
// shared key appears in the apps that use it and nowhere else.
//
// Pure data and helpers: the editors (to read and write) and the apps' servers (to split a stored
// blob) both use it.

export const ALL_SETTING_KEYS = [
  // Privacy and accessibility follow the person, not the app.
  'telemetryEnabled',
  'reduceMotion',
  // Email and browser notifications. The accounts Worker's onboarding emails read `notifyTips`
  // from here.
  'notificationsEnabled',
  'notifyInviteResponse',
  'notifyComments',
  'notifyTips',
  'notifyMilestones',
  'notifyActionAssigned',
  'notifyMentions',
  // How the editors' chrome looks and handles, the same in each app.
  'panelOpacity',
  'uiScale',
  'uiScalePanels',
  'uiScaleToolbar',
  'uiScaleCornerButtons',
  'middleMousePan',
  'dockButtonNames',
  'powerUserMode',
  'minimalChrome',
  // Your own colours, offered in every app's swatches.
  'customSwatches',
] as const;

export type AllSettingKey = (typeof ALL_SETTING_KEYS)[number];

const ALL = new Set<string>(ALL_SETTING_KEYS);

export function isAllSetting(key: string): key is AllSettingKey {
  return ALL.has(key);
}

export type SettingsBlob = Record<string, unknown>;

// One flat set of preferences (as an editor holds them) split into the two scopes it is stored in.
export function splitSettings(prefs: SettingsBlob): { all: SettingsBlob; app: SettingsBlob } {
  const all: SettingsBlob = {};
  const app: SettingsBlob = {};
  for (const [key, value] of Object.entries(prefs)) (ALL.has(key) ? all : app)[key] = value;
  return { all, app };
}

// The two stored scopes as one flat set. A shared key only ever comes from `all`, so a stale copy
// left in an app's own row can never win over it.
export function joinSettings(all: SettingsBlob, app: SettingsBlob): SettingsBlob {
  const joined: SettingsBlob = {};
  for (const [key, value] of Object.entries(app)) if (!ALL.has(key)) joined[key] = value;
  for (const [key, value] of Object.entries(all)) if (ALL.has(key)) joined[key] = value;
  return joined;
}

export {
  PRESENCE_COLOUR_VALUES,
  PRESENCE_COLOURS,
  presenceColour,
  type PresenceColour,
} from './presence';
