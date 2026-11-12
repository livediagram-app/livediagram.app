'use client';

// GitHub as the Automations screen offers it (docs/specs/026-plan/automations.md "GitHub triggers"): whether this
// deployment has the App (`githubEnabled`, from the one capabilities read), the plan, the way to the GitHub view, and
// the rule the builder holds now, so a GitHub trigger's panel can keep it for the round trip to GitHub. Provided by
// the Automations dialog; absent (null) outside it.

import { createContext, use } from 'react';
import type { AutomationRuleBody } from '@liveplanner/items';
import type { AutomationsScope } from '../automations-client';

export type GithubAutomations = {
  enabled: boolean;
  scope: AutomationsScope;
  openView: () => void;
  // The builder's new rule as it stands (null outside one), and the builder's way to keep it current.
  draft: () => AutomationRuleBody | null;
  keepDraft: (body: AutomationRuleBody | null) => void;
};

export const GithubAutomationsContext = createContext<GithubAutomations | null>(null);

export function useGithubAutomations(): GithubAutomations | null {
  return use(GithubAutomationsContext);
}
