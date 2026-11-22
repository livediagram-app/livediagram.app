// What liveplanner hands the platform's Automations before the screen's code loads (docs/specs/026-plan/
// automations.md "Where it shows"; the platform's blueprint ui.md "The door"): its words, its routes and its
// telemetry. Read by the host, the footer's Tools row and, inside the screen, the kit (plan-kit.tsx). It imports
// nothing of the screen, so the editor's first load carries none of it (plan-automations-lazy.test.ts).

import { isGithubKind, type AutomationTriggerKind } from '@liveplanner/items';
import type { AutomationsPlumbing } from '@liveworkspace/automations-ui/kit';
import { track } from '@/lib/telemetry';
import { PLAN_AUTOMATIONS_CLIENT } from './plan-client';

export const PLAN_AUTOMATIONS_WORDS: AutomationsPlumbing['words'] = {
  item: 'plan',
  subject: 'card',
  toolLine: 'Rules that act on cards for you.',
  subtitle: 'Rules that act on this plan’s cards for you when something happens.',
  empty:
    'A rule watches this plan and does the routine steps for you: moving, assigning, labelling and telling people about cards. Start from one below or build your own.',
  // A plan's rules run on cards, so its test says so (the platform's name is Test Rule).
  test: 'Test on a Card',
};

// Each of the screen's events as liveplanner's telemetry says it (docs/specs/017-telemetry/telemetry.md), written out
// so the emitted pairs stay where the coverage guard reads them.
function trackAutomations(event: Parameters<AutomationsPlumbing['track']>[0], detail?: string) {
  switch (event) {
    case 'opened':
      return track('UI', 'Opened', 'Automations');
    case 'opened_offline':
      return track('UI', 'Opened', 'AutomationsOffline');
    case 'opened_sign_in':
      return track('UI', 'Opened', 'AutomationsSignIn');
    case 'describe_opened':
      return track('UI', 'Opened', 'AutomationDescribe');
    case 'template_opened':
      return track('UI', 'Opened', `AutomationTemplate.${detail ?? ''}`);
    case 'rule_created':
      track('Plan', 'Created', 'AutomationRule');
      // `detail`: the new rule's trigger kind.
      if (detail && isGithubKind(detail as AutomationTriggerKind))
        track('Plan', 'Created', 'AutomationRuleGithub');
      return;
    case 'draft_created':
      return track('Plan', 'Created', 'AutomationDraft');
    case 'secret_created':
      return track('Plan', 'Created', 'AutomationSecret');
    case 'secret_changed':
      return track('Plan', 'Changed', 'AutomationSecret');
    case 'secret_copied':
      return track('Plan', 'Copied', 'AutomationSecret');
    case 'rule_on':
      return track('Plan', 'Toggled', 'AutomationOn');
    case 'rule_off':
      return track('Plan', 'Toggled', 'AutomationOff');
    case 'rule_taken_over':
      return track('Plan', 'Toggled', 'AutomationTakenOver');
    case 'rule_deleted':
      return track('Plan', 'Deleted', 'AutomationRule');
    case 'rule_tested':
      return track('Plan', 'Tested', 'AutomationRule');
  }
}

export const PLAN_AUTOMATIONS_PLUMBING: AutomationsPlumbing = {
  words: PLAN_AUTOMATIONS_WORDS,
  client: PLAN_AUTOMATIONS_CLIENT,
  track: trackAutomations,
};
