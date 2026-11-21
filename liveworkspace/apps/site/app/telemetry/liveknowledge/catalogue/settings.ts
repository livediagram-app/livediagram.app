// The editor Settings dialog, one stack per category, one chart per row (docs/specs/017-telemetry/telemetry.md).
// Part of the metric catalogue: import from ../metric-catalogue.

import type { Metric, MetricStack } from '../../_shared/metric-series';

// ---- Settings tab ------------------------------------------------------------
// One chart per row of the editor's Settings dialog, one stack per Settings
// category (apps/editor settings-catalogue.ts, in its order). Every row emits
// generically from settings-model.tsx (bindRow): a toggle `Toggled·<X>On` / `<X>Off`,
// a choice `Changed·<X><Option>`, a slider `Changed·<X>`. Each chart counts
// every change to its setting, both directions, so whether a setting is
// flipped at all reads at a glance; which way it went is in Search. Neutral:
// a changed setting is neither good nor bad. `metric-emitters.test` fails if a
// Settings row has no chart here.
const toggle = (
  category: string,
  on: string,
  off: string,
  title: string,
  blurb: string,
): Metric => ({
  category,
  action: 'Toggled',
  typeIn: (type) => type === on || type === off,
  title,
  blurb,
  rising: 'neutral',
});

const changed = (prefix: string, title: string, blurb: string, exact = false): Metric => ({
  category: 'UI',
  action: 'Changed',
  typeIn: (type) => (exact ? type === prefix : (type ?? '').startsWith(prefix)),
  title,
  blurb,
  rising: 'neutral',
});

const settingsStack = (title: string, blurb: string, members: Metric[]): MetricStack => ({
  stack: true,
  title,
  blurb,
  members,
  rising: 'neutral',
});

export const APPEARANCE_SETTINGS = settingsStack('Appearance Settings', 'How the editor looks.', [
  {
    category: 'UI',
    action: 'Toggled',
    typeIn: (type) => type === 'Light' || type === 'Dark' || type === 'System',
    title: 'Theme',
    blurb: 'Light, Dark or System picked, from the header toggle or Settings.',
    rising: 'neutral',
  },
  toggle(
    'UI',
    'DockButtonNamesOn',
    'DockButtonNamesOff',
    'Button Labels',
    'Names beside the bottom-right buttons’ icons on a wide desktop.',
  ),
  changed('UiScale', 'UI Scale', 'The panels, toolbar and corner buttons’ size slider.', true),
  changed('UiScalePanels', 'Panel Scale', 'The panels’ own size slider.', true),
  changed('UiScaleToolbar', 'Toolbar Scale', 'The toolbar’s own size slider.', true),
  changed(
    'UiScaleCornerButtons',
    'Corner Buttons Scale',
    'The bottom-right buttons’ own size slider.',
    true,
  ),
]);

export const KEYBOARD_SETTINGS = settingsStack(
  'Keyboard Settings',
  'Keyboard shortcuts on or off.',
  [
    toggle(
      'UI',
      'ShortcutsOn',
      'ShortcutsOff',
      'Keyboard Shortcuts',
      'Single-key shortcuts switched on or off, for this device.',
    ),
  ],
);

export const PANELS_SETTINGS = settingsStack(
  'Panels Settings',
  'The panels: how see-through they are, and whether other people’s cursors show.',
  [
    changed('PanelOpacity', 'Panel Opacity', 'The panels’ transparency slider.', true),
    toggle(
      'UI',
      'HideCursorsOn',
      'HideCursorsOff',
      'Hide Participant Cursors',
      'Other people’s cursors hidden or shown, for this device.',
    ),
  ],
);

export const ACCESSIBILITY_SETTINGS = settingsStack('Accessibility Settings', 'Motion.', [
  toggle('UI', 'ReduceMotionOn', 'ReduceMotionOff', 'Reduce Motion', 'Turning animation down.'),
]);

// Getting Started: the Show Me tours' switches, one over them all and one per toured element. Each switch's tokens
// track its PREFERENCE, so switching a tour on is `…SeenOff`.
export const TOURS_SETTINGS = settingsStack(
  'Getting Started Settings',
  'The Show Me tours switched back on or off.',
  [
    {
      category: 'UI',
      action: 'Toggled',
      typeIn: (type) => /^[A-Z][A-Za-z]*Tours?Seen(On|Off)$/.test(type ?? ''),
      title: 'Show Me Tours',
      blurb: 'The Show Me tours switched back on or off, all at once or one element’s.',
      rising: 'neutral',
    },
  ],
);

export const EXPLORER_SETTINGS = settingsStack(
  'Explorer Settings',
  'Where the homepage opens and what Explorer Home shows.',
  [
    toggle(
      'UI',
      'AutoOpenExplorerOn',
      'AutoOpenExplorerOff',
      'Automatically Open Explorer',
      'The homepage opening straight on the Explorer.',
    ),
    toggle(
      'UI',
      'HomeBannerOn',
      'HomeBannerOff',
      'Home Banner',
      'The greeting and large search at the top of Explorer Home, closed from its corner or switched in Settings.',
    ),
  ],
);

export const NOTIFICATION_SETTINGS = settingsStack(
  'Notification Settings',
  'In-editor notifications and each email opt-out.',
  [
    toggle(
      'UI',
      'NotificationsOn',
      'NotificationsOff',
      'In-Editor Notifications',
      'Toasts and the notification bell.',
    ),
    toggle(
      'UI',
      'NotifyCommentsOn',
      'NotifyCommentsOff',
      'Someone Comments on My Knowledgebase',
      'The new-comment email.',
    ),
    toggle(
      'UI',
      'NotifyMentionsOn',
      'NotifyMentionsOff',
      'Someone Mentions Me in a Comment',
      'The comment-mention email.',
    ),
    toggle(
      'UI',
      'NotifyActionAssignedOn',
      'NotifyActionAssignedOff',
      'Someone Assigns Me an Action',
      'The action-assigned email.',
    ),
    toggle(
      'UI',
      'NotifyInviteResponseOn',
      'NotifyInviteResponseOff',
      'Someone Responds to a Team Invite',
      'The invite-response email.',
    ),
    toggle(
      'UI',
      'NotifyDocumentJoinOn',
      'NotifyDocumentJoinOff',
      'Someone Joins My Knowledgebase',
      'The knowledgebase-joined email.',
    ),
    toggle(
      'UI',
      'NotifyKnowledgeReviewsOn',
      'NotifyKnowledgeReviewsOff',
      'Knowledgebase Reviews',
      'The emails about pages you own: a review due, two pages that disagree, or an Editor reminding their owners.',
    ),
    toggle(
      'UI',
      'NotifyTipsOn',
      'NotifyTipsOff',
      'Tips and Check-Ins',
      'The onboarding and win-back emails.',
    ),
    toggle(
      'UI',
      'NotifyMilestonesOn',
      'NotifyMilestonesOff',
      'Milestones',
      'The milestone and first-share emails.',
    ),
  ],
);

export const PRIVACY_SETTINGS = settingsStack(
  'Privacy Settings',
  'Anonymous usage events, the thing this dashboard counts.',
  [
    toggle(
      'UI',
      'TelemetryOn',
      'TelemetryOff',
      'Send Anonymous Usage Events',
      'The opt-out, fired before it takes effect so the change still arrives.',
    ),
  ],
);

// In the order of the editor's Settings categories (apps/editor settings-catalogue.ts).
export const SETTINGS_STACKS: readonly MetricStack[] = [
  APPEARANCE_SETTINGS,
  KEYBOARD_SETTINGS,
  PANELS_SETTINGS,
  ACCESSIBILITY_SETTINGS,
  TOURS_SETTINGS,
  EXPLORER_SETTINGS,
  NOTIFICATION_SETTINGS,
  PRIVACY_SETTINGS,
];

// Settings changed, one chart per Settings category, for the Dashboard.
const categoryChart = (stack: MetricStack): Metric => {
  const first = stack.members[0]!;
  const actions = [...new Set(stack.members.map((m) => m.action))];
  return {
    category: first.category,
    action: actions[0]!,
    ...(actions.length > 1 ? { actionIn: actions.slice(1) } : {}),
    typeIn: (type) => stack.members.some((m) => m.typeIn?.(type)),
    title: stack.title.replace(/ Settings$/, ''),
    blurb: stack.blurb,
    rising: 'neutral',
  };
};

export const SETTINGS_CHANGED: MetricStack = {
  stack: true,
  title: 'Settings Changed',
  blurb:
    'Settings changed, by Settings category. The theme counts the header toggle as well as the dialog.',
  members: SETTINGS_STACKS.map(categoryChart),
  rising: 'neutral',
  seeAlso: { tab: 'settings', label: 'See Each Setting on the Settings Tab' },
};
