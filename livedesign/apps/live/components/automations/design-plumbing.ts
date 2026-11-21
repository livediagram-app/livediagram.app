// What livedesign hands the platform's Automations before the screen's code loads (docs/specs/013-workspace/
// automations.md; blueprint automations.md "Editor", "The plumbing"): its routes over this editor's api core, its
// words and its telemetry. Read by the host, the footer's Tools row and, inside the screen, the kit
// (design-kit.tsx). It imports nothing of the screen, so the editor's first load carries none of it
// (design-automations-lazy.test.ts).

import {
  createItemAutomationsClient,
  defineItemPlumbing,
} from '@liveworkspace/automations-ui/item/plumbing';
import type { AutomationsPlumbing } from '@liveworkspace/automations-ui/kit';
import { API_BASE, apiFetch, apiHeaders, expectOk, expectOkVoid } from '@/lib/api/core';
import { track } from '@/lib/telemetry';

/** A design's Automations address, no trailing slash. */
export const automationsBase = (designId: string): string =>
  `${API_BASE}/designs/${encodeURIComponent(designId)}/automations`;

// Each module function is read at the call, so a test's mock of one is the one called.
export const DESIGN_AUTOMATIONS_CLIENT = createItemAutomationsClient({
  base: (scope) => automationsBase(scope.itemId),
  fetch: (url, init) => apiFetch(url, init),
  headers: (scope, body) => apiHeaders(scope.ownerId, { share: scope.shareCode, body }),
  expectOk: (res, action) => expectOk(res, action),
  expectOkVoid: (res, action) => expectOkVoid(res, action),
});

// Each of the screen's events as livedesign's telemetry says it (docs/specs/017-telemetry/telemetry.md), written
// out so the emitted pairs stay where the coverage guard reads them.
export function trackDesignAutomations(
  event: Parameters<AutomationsPlumbing['track']>[0],
  detail?: string,
): void {
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
      // `detail`: the template's id (DESIGN_TEMPLATES), short enough for a type.
      return track('UI', 'Opened', `AutomationTemplate.${detail ?? ''}`);
    case 'rule_created':
      return track('Document', 'Created', 'AutomationRule');
    case 'draft_created':
      return track('Document', 'Created', 'AutomationDraft');
    case 'secret_created':
      return track('Document', 'Created', 'AutomationSecret');
    case 'secret_changed':
      return track('Document', 'Changed', 'AutomationSecret');
    case 'secret_copied':
      return track('Document', 'Copied', 'AutomationSecret');
    case 'rule_on':
      return track('Document', 'Toggled', 'AutomationOn');
    case 'rule_off':
      return track('Document', 'Toggled', 'AutomationOff');
    case 'rule_deleted':
      return track('Document', 'Deleted', 'AutomationRule');
    case 'rule_tested':
      return track('Document', 'Tested', 'AutomationRule');
    case 'rule_run':
      return track('Document', 'Ran', 'AutomationManual');
  }
}

export const DESIGN_AUTOMATIONS_PLUMBING: AutomationsPlumbing = defineItemPlumbing({
  itemWord: 'design',
  examples:
    'Tell Slack when the library changes, snapshot every Friday, or email me when an agent edits.',
  client: DESIGN_AUTOMATIONS_CLIENT,
  track: trackDesignAutomations,
});
