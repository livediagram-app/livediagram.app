'use client';

// Automations for this session (docs/specs/026-plan/automations.md "Where it shows"): present only for an Editor of
// the whole plan on a plan saved to an account (automations-gate.ts), so the footer button, a card's Run Rule and an
// Automation comment's link to its rule all read one value, and none of them draws for anyone else.

import { createContext, use } from 'react';
import type { AutomationsScope } from './automations-client';

// Where the screen opens: the Rules list, one rule's builder (null: a new rule), or the Run Log (one rule's runs).
export type AutomationsTarget =
  { view: 'rules' } | { view: 'rule'; ruleId: string | null } | { view: 'runs'; ruleId?: string };

export type AutomationsAccess = {
  scope: AutomationsScope;
  open: (target?: AutomationsTarget) => void;
};

export const AutomationsContext = createContext<AutomationsAccess | null>(null);

export function useAutomationsAccess(): AutomationsAccess | null {
  return use(AutomationsContext);
}
