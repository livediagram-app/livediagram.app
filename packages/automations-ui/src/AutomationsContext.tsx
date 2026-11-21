'use client';

// Automations for this session (liveworkspace/docs/specs/018-automations/automations.md "Who may do what"; blueprint
// ui.md "The door"): present only for an Editor of the whole item on an item saved to an account
// (automations-gate.ts), so the footer's row, an app's own Run Rule and a link to a rule all read one value, and none
// of them draws for anyone else.

import { createContext, use } from 'react';
import type { KeptRule } from './kit-context';
import type { AutomationsPlumbing, AutomationsScope } from './kit';

// Where the screen opens: the Rules list, one rule's builder (null: a new rule, blank, from a template, drafted, or
// one kept from before), the Audit Trail (one rule's runs), the Templates tab, the Connections tab, or one of the
// app's own views (with what its opener hands it).
export type AutomationsTarget =
  | { view: 'rules' }
  // `draft`: the rule Describe a Rule drafted, which the screen holds (never in the address). `kept`: a rule kept
  // from before (an app's round trip, or Back to Rule from the Connections tab), opened as it was left.
  | { view: 'rule'; ruleId: string | null; template?: string; draft?: true; kept?: KeptRule }
  | { view: 'runs'; ruleId?: string }
  | { view: 'templates' }
  | { view: 'connections' }
  | { view: 'view'; id: string; arrival?: unknown };

export type AutomationsAccess = {
  scope: AutomationsScope;
  plumbing: AutomationsPlumbing;
  open: (target?: AutomationsTarget) => void;
};

export const AutomationsContext = createContext<AutomationsAccess | null>(null);

export function useAutomationsAccess(): AutomationsAccess | null {
  return use(AutomationsContext);
}

// The footer row's way in: present for an Editor on an item saved to an account (it opens the screen) and for
// whoever can edit an item kept Offline or is not signed in (it opens the gate).
// `badges`: what it needs first (Sign In, Sync) while a press opens its gate.
export type AutomationsDoor = {
  open: () => void;
  offline: boolean;
  plumbing: AutomationsPlumbing;
  badges?: readonly string[] | undefined;
};

export const AutomationsDoorContext = createContext<AutomationsDoor | null>(null);

export function useAutomationsDoor(): AutomationsDoor | null {
  return use(AutomationsDoorContext);
}
