'use client';

// GitHub as the Automations screen offers it (docs/specs/026-plan/automations.md "GitHub triggers"): whether this
// deployment has the App (`githubEnabled`, from the one capabilities read), the plan, the way to the GitHub view, and
// the rule the builder holds now, so a GitHub trigger's panel can keep it for the round trip to GitHub. Provided by
// the Automations dialog; absent (null) outside it.

import { createContext, use } from 'react';
import type { AutomationsScope } from '../automations-client';
import type { KeptRule } from './github-hash';

export type GithubAutomations = {
  enabled: boolean;
  scope: AutomationsScope;
  openView: () => void;
  // The builder's new rule as it stands, with a template's picks (null outside one), and the builder's way to keep
  // it current.
  draft: () => KeptRule | null;
  keepDraft: (kept: KeptRule | null) => void;
};

export const GithubAutomationsContext = createContext<GithubAutomations | null>(null);

export function useGithubAutomations(): GithubAutomations | null {
  return use(GithubAutomationsContext);
}
