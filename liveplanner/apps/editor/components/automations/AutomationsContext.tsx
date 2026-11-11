'use client';

// Automations for this session (docs/specs/026-plan/automations.md "Where it shows"): present only for an Editor of
// the whole plan on a plan saved to an account (automations-gate.ts), so the footer button, a card's Run Rule and an
// Automation comment's link to its rule all read one value, and none of them draws for anyone else.

import { createContext, use } from 'react';
import type { AutomationTemplateId } from '@liveplanner/items';
import type { AutomationsScope } from './automations-client';

// Where the screen opens: the Rules list, one rule's builder (null: a new rule, blank or from a template), the Run
// Log (one rule's runs), or the Templates tab.
export type AutomationsTarget =
  | { view: 'rules' }
  | { view: 'rule'; ruleId: string | null; template?: AutomationTemplateId }
  | { view: 'runs'; ruleId?: string }
  | { view: 'templates' };

export type AutomationsAccess = {
  scope: AutomationsScope;
  open: (target?: AutomationsTarget) => void;
};

export const AutomationsContext = createContext<AutomationsAccess | null>(null);

export function useAutomationsAccess(): AutomationsAccess | null {
  return use(AutomationsContext);
}

// The footer button's way in: present for an Editor on a plan saved to an account (it opens the screen) and for
// whoever can edit a plan in Browser Storage (it opens Rules Run on Our Servers).
export type AutomationsDoor = { open: () => void; offline: boolean };

export const AutomationsDoorContext = createContext<AutomationsDoor | null>(null);

export function useAutomationsDoor(): AutomationsDoor | null {
  return use(AutomationsDoorContext);
}
