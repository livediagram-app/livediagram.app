// The editor Settings dialog, one stack per category, one chart per row (spec/22).
// Part of the metric catalogue: import from ../metric-catalogue.

import type { Metric, MetricStack } from '../metric-series';

// ---- Settings tab ------------------------------------------------------------
// One chart per row of the editor's Settings dialog, one stack per Settings
// category (apps/live settings-catalogue.ts, in its order). Every row emits
// generically from SettingsCategoryPane: a toggle `Toggled·<X>On` / `<X>Off`,
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

export const EDITOR_SETTINGS = settingsStack(
  'Editor Settings',
  'How the canvas behaves while you draw.',
  [
    toggle(
      'UI',
      'QuickAddHoverOn',
      'QuickAddHoverOff',
      'Quick-Add on Hover',
      'Hover handles that add a connected shape.',
    ),
    toggle(
      'UI',
      'AlignmentGuidesOn',
      'AlignmentGuidesOff',
      'Alignment Guides',
      'Snap guides while dragging.',
    ),
    toggle(
      'UI',
      'AutoRebindOn',
      'AutoRebindOff',
      'Auto-Attach Arrows',
      'Arrows re-attaching to the nearest shape.',
    ),
  ],
);

export const APPEARANCE_SETTINGS = settingsStack('Appearance Settings', 'How the editor looks.', [
  {
    category: 'UI',
    action: 'Toggled',
    typeIn: (type) => type === 'Light' || type === 'Dark' || type === 'System',
    title: 'Theme',
    blurb: 'Light, Dark or System picked, from the header toggle or Settings.',
    rising: 'neutral',
  },
  changed('PanelLayout', 'Panel Layout', 'Floating, Minimal or Toolbar chrome.'),
  toggle('UI', 'MinimapOn', 'MinimapOff', 'Show Minimap', 'The minimap in the corner.'),
  changed('PanelOpacity', 'Panel Opacity', 'The panels\u2019 transparency slider.', true),
]);

export const CONTROLS_SETTINGS = settingsStack(
  'Controls Settings',
  'Mouse and trackpad behaviour.',
  [
    toggle(
      'UI',
      'MiddleMousePanOn',
      'MiddleMousePanOff',
      'Middle-Mouse Pan',
      'Panning with the middle mouse button.',
    ),
  ],
);

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
  'What the Layers, Activity and minimap panels show.',
  [
    toggle(
      'UI',
      'LayerPreviewOn',
      'LayerPreviewOff',
      'Layer Thumbnails',
      'Thumbnails in the Layers panel.',
    ),
    toggle(
      'UI',
      'LayerCountOn',
      'LayerCountOff',
      'Layer Element Counts',
      'Element counts on each layer.',
    ),
    toggle(
      'UI',
      'LayerHoverPreviewOn',
      'LayerHoverPreviewOff',
      'Preview Layer on Hover',
      'Highlighting a layer\u2019s elements on hover.',
    ),
    toggle(
      'UI',
      'ActivityRevertPreviewOn',
      'ActivityRevertPreviewOff',
      'Preview Revert on Hover',
      'Previewing a revert from the Activity panel.',
    ),
    toggle(
      'UI',
      'MapDimOn',
      'MapDimOff',
      'Dim Outside the View',
      'The minimap dimming what is off screen.',
    ),
    changed('MapSize', 'Minimap Size', 'Short, Medium or Tall.'),
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
      'NotifyDiagramJoinOn',
      'NotifyDiagramJoinOff',
      'Someone Joins My Diagram',
      'The diagram-joined email.',
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
      'NotifyCommentsOn',
      'NotifyCommentsOff',
      'Someone Comments on My Diagram',
      'The new-comment email.',
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

export const ACCESSIBILITY_SETTINGS = settingsStack(
  'Accessibility Settings',
  'Motion and the welcome tour.',
  [
    toggle('UI', 'ReduceMotionOn', 'ReduceMotionOff', 'Reduce Motion', 'Turning animation down.'),
    toggle(
      'UI',
      'TourSeenOff',
      'TourSeenOn',
      'Show Welcome Tour',
      'The welcome tour switched back on or off.',
    ),
  ],
);

export const AI_SETTINGS = settingsStack(
  'AI Tools Settings',
  'The AI assistant opt-in and its suggestions.',
  [
    toggle(
      'AI',
      'AiOn',
      'AiOff',
      'AI Assistant',
      'The AI assistant opt-in, switched on or off. AI is off until someone turns it on, so every AI request comes from people who did.',
    ),
    toggle(
      'AI',
      'AiSuggestedPromptsOn',
      'AiSuggestedPromptsOff',
      'Suggested Prompts',
      'Prompt suggestions in the AI panel.',
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

export const SETTINGS_STACKS: readonly MetricStack[] = [
  EDITOR_SETTINGS,
  APPEARANCE_SETTINGS,
  CONTROLS_SETTINGS,
  KEYBOARD_SETTINGS,
  PANELS_SETTINGS,
  NOTIFICATION_SETTINGS,
  ACCESSIBILITY_SETTINGS,
  AI_SETTINGS,
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
  blurb: 'Changes in the editor’s Settings dialog, by category.',
  members: SETTINGS_STACKS.map(categoryChart),
  rising: 'neutral',
  seeAlso: { view: 'settings', label: 'See Each Setting on the Settings Tab' },
};
