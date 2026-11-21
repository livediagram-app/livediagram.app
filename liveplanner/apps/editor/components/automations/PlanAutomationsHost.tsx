'use client';

// Gives the editor its Automations and draws the screen while it is open (docs/specs/026-plan/automations.md "Where
// it shows"): the platform's host (@liveworkspace/automations-ui) with liveplanner's plumbing, its screen and its
// gate. The screen's code (the platform's dialog with the plan's kit) and the gate's load the first time each opens
// (docs/specs/016-platform/web-performance.md), so a plan whose Editor never opens them pays nothing for them;
// plan-automations-lazy.test.ts keeps this file, the footer's row and the plumbing free of both. `#github=…` (where
// Connect GitHub comes back) opens the screen at the GitHub view, or at the rule kept for the round trip
// (GithubReturn).

import dynamic from 'next/dynamic';
import { createContext, use, type ReactNode } from 'react';
import {
  AutomationsHost,
  type AutomationsGate,
  type AutomationsScope,
} from '@liveworkspace/automations-ui';
import type { PlanContextValue } from '@/components/plan/PlanContext';
import { GithubReturn } from './github/GithubReturn';
import { PLAN_AUTOMATIONS_PLUMBING } from './plan-plumbing';

const PlanAutomationsScreen = dynamic(
  () => import('./PlanAutomationsScreen').then((m) => m.PlanAutomationsScreen),
  { ssr: false },
);
const PlanAutomationsGate = dynamic(
  () => import('./PlanAutomationsGate').then((m) => m.PlanAutomationsGate),
  { ssr: false },
);

// The plan the screen's pickers read: the host sits above the footer, outside the canvas's PlanProvider, so the
// screen provides it again around itself.
const ScreenPlanContext = createContext<PlanContextValue | undefined>(undefined);

export function useScreenPlan(): PlanContextValue | undefined {
  return use(ScreenPlanContext);
}

export function PlanAutomationsHost({
  scope,
  plan,
  gate = null,
  signedIn = false,
  children,
}: {
  plan: PlanContextValue | undefined;
  // Null for anyone but an Editor of the whole plan saved to an account (automationsScopeFor).
  scope: AutomationsScope | null;
  // Set for someone who could edit the plan but must sync it or sign in first (automationsGateFor).
  gate?: AutomationsGate | null;
  // Whether the person is signed in (connections are an account's).
  signedIn?: boolean;
  children: ReactNode;
}) {
  return (
    <ScreenPlanContext value={plan}>
      <AutomationsHost
        plumbing={PLAN_AUTOMATIONS_PLUMBING}
        scope={scope}
        gate={gate}
        signedIn={signedIn}
        Screen={PlanAutomationsScreen}
        Gate={PlanAutomationsGate}
      >
        <GithubReturn />
        {children}
      </AutomationsHost>
    </ScreenPlanContext>
  );
}
