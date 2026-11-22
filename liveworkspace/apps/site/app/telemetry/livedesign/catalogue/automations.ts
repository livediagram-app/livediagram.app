// Automations (docs/specs/017-telemetry/telemetry.md): the Automations screen's charts.
// Part of the metric catalogue: import from ../metric-catalogue.

import type { MetricStack } from '../../_shared/metric-series';
import { chart } from '../../_shared/catalogue-helpers';

// Automations (docs/specs/013-workspace/automations.md "Telemetry", in the livedesign folder): what an Editor does on
// the Automations screen. The kind only, never a rule's name, a message or a secret.
export const DESIGN_AUTOMATION_RULES = chart(
  'Document',
  'Created',
  'Automation Rules Made',
  'A rule saved for the first time on the Automations screen, or a rule Describe a Rule drafted opened in the builder, unsaved.',
  { types: ['AutomationRule', 'AutomationDraft'] },
);

export const DESIGN_AUTOMATIONS_TOGGLED = chart(
  'Document',
  'Toggled',
  'Automation Rules Turned On and Off',
  "A rule's switch flipped, on the Rules list or in the rule builder.",
  { types: ['AutomationOn', 'AutomationOff'], rising: 'neutral' },
);

export const DESIGN_AUTOMATIONS_DELETED = chart(
  'Document',
  'Deleted',
  'Automation Rules Deleted',
  'A rule deleted from the Automations screen.',
  { types: ['AutomationRule'], rising: 'neutral' },
);

export const DESIGN_AUTOMATIONS_TESTED = chart(
  'Document',
  'Tested',
  'Automation Rules Tested',
  'A rule tried with Test: it shows what the rule would do and changes nothing.',
  { types: ['AutomationRule'] },
);

export const DESIGN_AUTOMATIONS_RAN = chart(
  'Document',
  'Ran',
  'Automation Rules Run by Hand',
  'A Run by Hand rule started from the Automations screen.',
  { types: ['AutomationManual'] },
);

export const DESIGN_AUTOMATIONS_TAKEN_OVER = chart(
  'Document',
  'Toggled',
  'Automation Rules Taken Over',
  "A rule paused on a step in another app's lost access, saved as someone else's with Take Over Rule and turned back on.",
  { types: ['AutomationTakenOver'], rising: 'neutral' },
);

export const DESIGN_AUTOMATION_SECRETS = chart(
  'Document',
  'Created',
  'Incoming Webhook Secrets',
  "An Incoming Webhook rule's secret made for the first time.",
  { types: ['AutomationSecret'], rising: 'neutral' },
);

export const DESIGN_AUTOMATION_SECRETS_CHANGED = chart(
  'Document',
  'Changed',
  'Incoming Webhook Secrets Changed',
  "An Incoming Webhook rule's secret made again, which stops the old one working.",
  { types: ['AutomationSecret'], rising: 'neutral' },
);

export const DESIGN_AUTOMATION_SECRETS_COPIED = chart(
  'Document',
  'Copied',
  'Incoming Webhook Secrets Copied',
  "An Incoming Webhook rule's new secret copied, to paste into the service that calls it.",
  { types: ['AutomationSecret'], rising: 'neutral' },
);

export const DESIGN_AUTOMATIONS: MetricStack = {
  stack: true,
  title: 'Automations',
  blurb:
    'Rules a design runs on its own, as Editors make them on the Automations screen: saved, turned on and off, tested, run by hand and deleted, and the Incoming Webhook secrets they make and copy.',
  members: [
    DESIGN_AUTOMATION_RULES,
    DESIGN_AUTOMATIONS_TOGGLED,
    DESIGN_AUTOMATIONS_TESTED,
    DESIGN_AUTOMATIONS_RAN,
    DESIGN_AUTOMATIONS_TAKEN_OVER,
    DESIGN_AUTOMATIONS_DELETED,
    DESIGN_AUTOMATION_SECRETS,
    DESIGN_AUTOMATION_SECRETS_CHANGED,
    DESIGN_AUTOMATION_SECRETS_COPIED,
  ],
};
