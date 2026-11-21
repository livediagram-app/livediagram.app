// Tests only: the plan's kit as the platform's screen reads it where no provider stands, so a test draws one of the
// platform's panels, or one of the plan's own that uses them, without wrapping it (the editor provides the kit
// around the screen: PlanAutomationsScreen). Imported for its effect, first, by each such test.

import { setFallbackAutomationsKit } from '@liveworkspace/automations-ui/kit-context';
import { PLAN_AUTOMATIONS_KIT } from './plan-kit';

setFallbackAutomationsKit(PLAN_AUTOMATIONS_KIT);
