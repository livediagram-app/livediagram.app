'use client';

// The Automations screen as liveplanner draws it (docs/specs/026-plan/automations.md "The Automations screen"): the
// platform's dialog, with the plan's kit and the plan its pickers read. Loaded with its own chunk the first time the
// screen opens (PlanAutomationsHost).

import { AutomationsDialog } from '@liveworkspace/automations-ui/AutomationsDialog';
import type { AutomationsScreenProps } from '@liveworkspace/automations-ui/AutomationsHost';
import { AutomationsKitProvider } from '@liveworkspace/automations-ui/kit-context';
import { PlanProvider } from '@/components/plan/PlanContext';
import { useScreenPlan } from './PlanAutomationsHost';
import { PLAN_AUTOMATIONS_KIT } from './plan-kit';

export function PlanAutomationsScreen(props: AutomationsScreenProps) {
  const plan = useScreenPlan();
  return (
    <PlanProvider value={plan}>
      <AutomationsKitProvider kit={PLAN_AUTOMATIONS_KIT}>
        <AutomationsDialog {...props} />
      </AutomationsKitProvider>
    </PlanProvider>
  );
}
