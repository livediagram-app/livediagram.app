// Which of a person's settings every app shares (liveworkspace/docs/specs/003-accounts/accounts.md "Settings"). The
// accounts database keeps two rows per person: the `all` scope, which every app reads and shows,
// and one per app. A key listed here lives in `all`, so changing it in one app changes it in every
// app that has it; any other key is the app's own. An app shows only the settings it has, so a
// shared key appears in the apps that use it and nowhere else.
//
// Pure data and helpers: the editors (to read and write) and the apps' servers (to split a stored
// blob) both use it.

// The editor settings two or more apps have, shared since October 2026 (liveworkspace/docs/specs/003-accounts/accounts.md "Common
// settings"): the same type, values and default in every app that has one. The Settings panel's All view shows them
// once, under Common. They were each app's own before, so a person's value may still sit in an app's scope:
// joinSettings falls back to it, and splitSettings drops it on the first write.
export const COMMON_SETTING_KEYS = [
  'homeBanner',
  'collaboratePanelEnabled',
  'quickStylePanelEnabled',
  'layersPanelEnabled',
  'layersShowPreview',
  'layersShowCount',
  'layerHoverPreview',
  'showMinimap',
  'mapSize',
  'mapDimOutside',
  'alignmentGuides',
  'autoRebindArrows',
  'elementIndicatorStyle',
  'quickAddOnHover',
  'contentsPlacement',
  'presentation',
] as const;

export type CommonSettingKey = (typeof COMMON_SETTING_KEYS)[number];

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
  // Phone notifications' switches, one per kind (./push.ts PUSH_SETTING_KEYS): the accounts Worker reads them when an
  // app asks it to send.
  'pushComments',
  'pushMentions',
  'pushActionAssigned',
  'pushThreadReplies',
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
  // The editor settings two or more apps have.
  ...COMMON_SETTING_KEYS,
] as const;

export type AllSettingKey = (typeof ALL_SETTING_KEYS)[number];

const ALL = new Set<string>(ALL_SETTING_KEYS);
const COMMON = new Set<string>(COMMON_SETTING_KEYS);

export function isAllSetting(key: string): key is AllSettingKey {
  return ALL.has(key);
}

export function isCommonSetting(key: string): key is CommonSettingKey {
  return COMMON.has(key);
}

// The preference a Settings row stands for, by the row-key conventions every editor shares: a row's key is its
// preference's, except a UI scale part's (`uiScale-panels` writes `uiScalePanels`) and a Presenting option's
// (`presentation-loop`, `presentationAutoAdvance`: fields of `presentation`).
export function settingKeyOfRow(rowKey: string): string {
  const part = /^uiScale-(\w)(\w*)$/.exec(rowKey);
  if (part) return `uiScale${part[1]!.toUpperCase()}${part[2]}`;
  if (rowKey.startsWith('presentation-') || rowKey === 'presentationAutoAdvance') {
    return 'presentation';
  }
  return rowKey;
}

// Whether a Settings row's value is one every app shares, so the row says "All apps".
export function isAllSettingRow(rowKey: string): boolean {
  return ALL.has(settingKeyOfRow(rowKey));
}

export type SettingsBlob = Record<string, unknown>;

// A patch of preferences (as an editor holds them) split into the two scopes it is stored in. A common setting
// also deletes the app's old copy (`null` in the app's patch), so once `all` has it nothing can bring the old one
// back there, even a reset that deletes the key. Linear in the patch.
export function splitSettings(prefs: SettingsBlob): { all: SettingsBlob; app: SettingsBlob } {
  const all: SettingsBlob = {};
  const app: SettingsBlob = {};
  for (const [key, value] of Object.entries(prefs)) {
    if (!ALL.has(key)) {
      app[key] = value;
      continue;
    }
    all[key] = value;
    if (COMMON.has(key)) app[key] = null;
  }
  return { all, app };
}

// The two stored scopes as one flat set. A shared key comes from `all`, so a stale copy left in an
// app's own row never wins over it. A common setting `all` has no value for yet falls back to the
// app's own copy, kept there from before it was shared, so nobody loses what they had set.
export function joinSettings(all: SettingsBlob, app: SettingsBlob): SettingsBlob {
  const joined: SettingsBlob = {};
  for (const [key, value] of Object.entries(app)) {
    if (!ALL.has(key) || (COMMON.has(key) && !Object.hasOwn(all, key))) joined[key] = value;
  }
  for (const [key, value] of Object.entries(all)) if (ALL.has(key)) joined[key] = value;
  return joined;
}

export {
  cleanProfileName,
  PRESENCE_COLOUR_VALUES,
  PRESENCE_COLOURS,
  PROFILE_NAME_MAX,
  presenceColour,
  type PresenceColour,
} from './presence';
