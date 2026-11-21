// @liveworkspace/automations-ui: the Automations screen and builder, built once (liveworkspace/docs/specs/
// 018-automations/automations.md "Built once"; blueprint ui.md). This entry is the DOOR: all an editor loads with its
// first paint. The host, the footer's Tools row, the gate's rule, the shared list and the kit's types. It imports
// nothing of the screen: the screen (./AutomationsDialog and everything under it) is loaded by the app's own lazy
// component, with its kit. A test (door-lazy-load.test.ts) keeps it so.

export type * from './kit';
export type * from './types';
export { stepKey } from './types';
export { TEST_RULE } from './kit';
export {
  AutomationsContext,
  AutomationsDoorContext,
  useAutomationsAccess,
  useAutomationsDoor,
  type AutomationsAccess,
  type AutomationsDoor,
  type AutomationsTarget,
} from './AutomationsContext';
export {
  AUTOMATIONS_FIRST_READ_MS,
  AutomationsHost,
  type AutomationsGate,
  type AutomationsScreenProps,
} from './AutomationsHost';
export {
  AUTOMATIONS_PARAM,
  automationsGateFor,
  automationsScopeFor,
  type AutomationsGateInput,
  type AutomationsGateKind,
} from './automations-gate';
export { useAutomationsGate } from './use-automations-gate';
export { useAutomationsToolsItem } from './automations-tools-item';
export {
  AutomationRefusal,
  createAutomationsClient,
  type AutomationsApi,
  type AutomationsClient,
} from './automations-client';
export {
  foldHook,
  forgetAutomations,
  readAutomations,
  readAutomationsFor,
  useAutomations,
  type AutomationsApi as AutomationsList,
  type AutomationsState,
  type AutomationsStatus,
} from './use-automations';
export { AutomationDisc, BoltIcon } from './glyphs';
export type { KeptRule } from './kit-context';
