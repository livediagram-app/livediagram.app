// Connect GitHub (docs/specs/026-plan/automations.md "The GitHub view"): the rule being built kept for the round trip
// (when it started from a GitHub trigger's panel), then GitHub's install page; and what the screen says about a
// return (github-hash.ts reads it).

import type { AutomationRuleBody } from '@liveplanner/items';
import { track } from '@/lib/telemetry';
import type { AutomationsScope } from '../automations-client';
import { startGithubConnect } from './github-client';
import { keepGithubDraft, type GithubResult } from './github-hash';

export type { GithubResult } from './github-hash';

/** Connect GitHub: GitHub's install page asked for, the draft kept (or cleared), then the page goes there. A refusal
 *  throws for the caller to show. */
export async function goConnectGithub(
  scope: AutomationsScope,
  draft: AutomationRuleBody | null,
  go: (url: string) => void = (url) => window.location.assign(url),
): Promise<void> {
  track('Plan', 'Started', 'GithubConnect');
  const url = await startGithubConnect(scope);
  keepGithubDraft(scope.projectId, draft);
  go(url);
}

/** What the GitHub view says about a return. */
export const GITHUB_RESULT_WORDS: Readonly<Record<GithubResult, string>> = {
  connected: 'GitHub is connected. The repositories this plan hears are below.',
  failed: 'GitHub didn’t connect. Try again, or check the App is installed on that account.',
  requested:
    'An owner of that organisation must approve the install on GitHub. Connect again once they have.',
};

/** The same, for the rule the person came back to. */
export const GITHUB_RULE_WORDS: Readonly<Record<GithubResult, string>> = {
  connected: 'GitHub is connected. Finish the rule and save it.',
  failed: GITHUB_RESULT_WORDS.failed,
  requested: GITHUB_RESULT_WORDS.requested,
};
