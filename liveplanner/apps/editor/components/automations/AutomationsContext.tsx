'use client';

// Automations for this session (docs/specs/026-plan/automations.md "Where it shows"): present only for an Editor of
// the whole plan on a plan saved to an account (automations-gate.ts), so the footer button, a card's Run Rule and an
// Automation comment's link to its rule all read one value, and none of them draws for anyone else.

import { createContext, use } from 'react';
import type { AutomationRuleBody, AutomationTemplateId } from '@liveplanner/items';
import type { AutomationsScope } from './automations-client';
import type { GithubResult } from './github/github-hash';

// Where the screen opens: the Rules list, one rule's builder (null: a new rule, blank, from a template, or the draft
// kept for the round trip to GitHub), the Run Log (one rule's runs), the Templates tab, or the GitHub view (with how a
// round trip to GitHub went).
export type AutomationsTarget =
  | { view: 'rules' }
  // `draft`: the rule Describe a Rule drafted, which the screen holds (never in the address). `kept`: the rule kept
  // for the round trip to GitHub, with how it went.
  | {
      view: 'rule';
      ruleId: string | null;
      template?: AutomationTemplateId;
      draft?: true;
      kept?: AutomationRuleBody;
      github?: GithubResult;
    }
  | { view: 'runs'; ruleId?: string }
  | { view: 'templates' }
  | { view: 'github'; result?: GithubResult };

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
