// Automations on the wire (docs/specs/013-workspace/automations.md;
// liveworkspace/docs/specs/018-automations/blueprints/item-engine.md "Wire types", "Routes"): the request and response
// bodies of
// `/api/documents/:id/automations[/…]` and the Incoming Webhook door. The shapes are every app's
// (@liveworkspace/api-schema/automations), generic over the rule, the run and the need; here they are filled in with
// the item engine's own (@liveworkspace/automations/item), which is what a document's rules are. Types only, beside
// the two error lists.
import type * as Wire from '@liveworkspace/api-schema/automations';
import type { AutomationRuleSummary, AutomationRun } from '@liveworkspace/automations';
import type { ItemPick, ItemRef, ItemRule, ItemRuleBody } from '@liveworkspace/automations/item';

export {
  AUTOMATION_ERRORS,
  AUTOMATION_HOOK_ERRORS,
  type AutomationError,
  type AutomationErrorBody,
  type AutomationHookAccepted,
  type AutomationHookError,
  type AutomationHookRequest,
  type AutomationOrderRequest,
  type AutomationRunNowRequest,
  type AutomationSecretResponse,
  type AutomationToggleRequest,
  type AutomationDraftRequest,
  type AutomationWireHook,
  type AutomationWireStats,
} from '@liveworkspace/api-schema/automations';

// A rule as stored, the part of it a save sends, and one run on the Audit Trail. A trigger, a condition and a step
// are each `{ kind, … }`; the kinds and their fields are @liveknowledge/document/automations' KINDS.
export type AutomationRule = ItemRule;
export type AutomationRuleBody = ItemRuleBody;
export type { AutomationRun };
// What a rule names that the document lacks: a tab, a snapshot, a connection, a template or a person, by id.
export type AutomationNeed = ItemRef;

export type AutomationListedRule = Wire.AutomationListedRule<AutomationRule, AutomationNeed>;
export type AutomationsListResponse = Wire.AutomationsListResponse<AutomationRule, AutomationNeed>;
export type AutomationRuleResponse = Wire.AutomationRuleResponse<AutomationRule, AutomationNeed>;
export type AutomationTestRequest = Wire.AutomationTestRequest<AutomationRuleBody>;
export type AutomationRunResponse = Wire.AutomationRunResponse<AutomationRun>;
export type AutomationRunsResponse = Wire.AutomationRunsResponse<AutomationRun>;
export type AutomationDraftResponse = Wire.AutomationDraftResponse<AutomationRuleBody, ItemPick>;
export type AutomationSummaryResponse = Wire.AutomationSummaryResponse<AutomationRuleSummary>;
