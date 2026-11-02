// The account's own settings, as plain data (liveworkspace/docs/specs/010-site/site.md "Settings", accounts.md "Settings"): the
// switches in the `all` scope that mean something without an editor, worded as the apps' own Settings word them,
// so a switch reads the same in the Settings panel's Account section as in any app. The editors' chrome (UI scale,
// panel opacity and the rest) is left out: it means nothing without an editor, and each app shows it in its own
// categories.
//
// The Settings panel (@liveworkspace/settings-ui) draws these as its Account section, wherever it is opened:
// liveworkspace.app, the Explorer on an app's address, and every editor.
import { ALL_SETTING_KEYS, isCommonSetting, type AllSettingKey, type SettingsBlob } from './index';

export interface AccountToggle {
  key: AllSettingKey;
  label: string;
  description: string;
  // Space-separated search synonyms.
  keywords?: string;
  // What an unset key means: the apps read most switches as on unless turned off.
  fallback: boolean;
}

const on = (
  key: AllSettingKey,
  label: string,
  description: string,
  keywords?: string,
): AccountToggle => ({
  key,
  label,
  description,
  fallback: true,
  ...(keywords ? { keywords } : {}),
});

export const NOTIFICATION_ROWS: AccountToggle[] = [
  on(
    'notifyComments',
    'Someone Comments on My Work',
    'Someone leaves a comment on a diagram, plan, document or design you own.',
    'email comment reply feedback',
  ),
  on(
    'notifyMentions',
    'Someone Mentions Me in a Comment',
    'A teammate @mentions you in a comment.',
    'email mention tag at comment',
  ),
  on(
    'notifyActionAssigned',
    'Someone Assigns Me an Action',
    'A teammate assigns you an action on an element.',
    'email action assigned task todo',
  ),
  on(
    'notifyInviteResponse',
    'Someone Responds to a Team Invite',
    'Someone you invited accepts or declines, for teams you are an admin of.',
    'email invite team accepted declined',
  ),
  on(
    'notifyTips',
    'Tips and Check-Ins',
    'Occasional getting-started tips, and a nudge if you have been away a while.',
    'email tips onboarding nudge newsletter',
  ),
  on(
    'notifyMilestones',
    'Milestones',
    'A note when you hit one, like sharing your first piece of work.',
    'email milestone achievement celebrate',
  ),
];

// Phone notifications, one switch per kind (./push.ts PUSH_SETTING_KEYS), beside the email ones they mirror. They
// matter only once a device is registered (the Phone section's Turn On Phone Notifications), so they are on unless
// turned off.
export const PUSH_ROWS: AccountToggle[] = [
  on(
    'pushComments',
    'Someone Comments on My Work',
    'Someone leaves a comment on a diagram, plan, document or design you own.',
    'phone push mobile comment feedback',
  ),
  on(
    'pushMentions',
    'Someone Mentions Me in a Comment',
    'A teammate @mentions you in a comment.',
    'phone push mobile mention tag at',
  ),
  on(
    'pushActionAssigned',
    'Someone Assigns Me an Action',
    'A teammate assigns you an action or a card.',
    'phone push mobile action assigned task todo card',
  ),
  on(
    'pushThreadReplies',
    'Replies to Threads I Commented In',
    'Someone replies in a comment thread you started or replied to.',
    'phone push mobile reply replies thread conversation',
  ),
];

export const IN_APP_ROWS: AccountToggle[] = [
  on(
    'notificationsEnabled',
    'In-Editor Notifications',
    'A brief note when something happens off screen, like moving something to a folder. Errors and warnings always show.',
    'toast popup confirmation message alert',
  ),
];

export const PRIVACY_ROWS: AccountToggle[] = [
  on(
    'telemetryEnabled',
    'Send Anonymous Usage Events',
    'Small first-party events, listed publicly on /telemetry, that show which features help. Never your content, no third-party trackers.',
    'analytics tracking usage data privacy anonymous',
  ),
];

export const ACCESSIBILITY_ROWS: AccountToggle[] = [
  {
    key: 'reduceMotion',
    label: 'Reduce Motion',
    description:
      'Turns off the apps’ animations and transitions on every device you use. Your device’s own setting is always respected too.',
    keywords: 'animation motion vestibular transitions accessibility',
    fallback: false,
  },
];

// Every switch the Account section shows.
export const ACCOUNT_TOGGLES: readonly AccountToggle[] = [
  ...NOTIFICATION_ROWS,
  ...PUSH_ROWS,
  ...IN_APP_ROWS,
  ...PRIVACY_ROWS,
  ...ACCESSIBILITY_ROWS,
];

export const ACCOUNT_KEYS: ReadonlySet<string> = new Set(ACCOUNT_TOGGLES.map((row) => row.key));

// Shared keys the Account section leaves to the apps: they only mean something inside an editor.
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

// Every shared key is in the Account section, in the Common group (a common setting, shown from the apps'
// catalogues) or deliberately left to the apps.
export function uncatalogued(): AllSettingKey[] {
  return ALL_SETTING_KEYS.filter(
    (key) => !ACCOUNT_KEYS.has(key) && !EDITOR_ONLY_KEYS.includes(key) && !isCommonSetting(key),
  );
}

// A switch's state from the stored scope: a boolean as stored, anything else its fallback.
export function readAccountToggle(all: SettingsBlob, row: AccountToggle): boolean {
  const value = all[row.key];
  return typeof value === 'boolean' ? value : row.fallback;
}

// Webhooks (liveworkspace/docs/specs/004-index/webhooks.md "Managing them"): an account's, like API tokens, made and
// managed in liveworkspace's Settings. The category's words wherever it shows, and the stand-in a guest's editor shows
// in its place (each editor's user-preferences.md), so the two read the same in every app.
export const WEBHOOKS_CATEGORY = {
  label: 'Webhooks',
  description:
    'Post what happens to your work, or your team’s, to a Slack or Microsoft Teams channel, or to a service you run.',
  keywords:
    'webhook webhooks slack microsoft teams channel post notify integration automation zapier url events signed',
  signInNote: 'Sign in to add webhooks.',
} as const;
