'use client';

// The rule the builder holds, as an Incoming Webhook rule's parts read it (docs/specs/026-plan/automations.md
// "Incoming Webhook"): whether it is one (Insert a Value then offers Webhook Field…), its saved id and its address and
// secret as the api last listed them (the trigger panel's Make Secret and Regenerate), and whether its steps can run
// with no card. Provided by RuleBuilder around its steps and panel.

import { createContext, use, type ReactNode } from 'react';
import type { AutomationHookInfo } from '@liveplanner/api-schema';

export type IncomingRule = {
  incoming: boolean;
  // The saved rule's id (null: not saved yet), and its address and secret as listed (absent: not saved as one yet).
  ruleId: string | null;
  hook: AutomationHookInfo | undefined;
  // Whether the rule as it stands can run with no card (@liveplanner/items runsWithoutCard).
  cardless: boolean;
  // The builder's clock, for when the secret was made and last used.
  now: number;
  // Whether the rule is on a GitHub trigger: Insert a Value then offers the pull request's values (automations.md
  // "GitHub triggers").
  github?: boolean;
};

const NONE: IncomingRule = {
  incoming: false,
  ruleId: null,
  hook: undefined,
  cardless: false,
  now: 0,
};

const IncomingRuleContext = createContext<IncomingRule>(NONE);

export function IncomingRuleProvider({
  value,
  children,
}: {
  value: IncomingRule;
  children: ReactNode;
}) {
  return <IncomingRuleContext.Provider value={value}>{children}</IncomingRuleContext.Provider>;
}

export function useIncomingRule(): IncomingRule {
  return use(IncomingRuleContext);
}
