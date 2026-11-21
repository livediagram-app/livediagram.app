// Connect GitHub (docs/specs/026-plan/automations.md "The GitHub view"): the rule being built kept for the round trip
// (when it started from a GitHub trigger's panel), then GitHub's install page; and what the screen says about a
// return (github-hash.ts reads it).

import { track } from '@/lib/telemetry';
import type { AutomationsScope } from '../automations-client';
import { startGithubConnect } from './github-client';
import { keepGithubDraft, type KeptRule } from './github-hash';

export type { GithubResult } from './github-hash';

/** Connect GitHub: GitHub's install page asked for, the draft kept (or cleared), then the page goes there. A refusal
 *  throws for the caller to show. */
export async function goConnectGithub(
  scope: AutomationsScope,
  draft: KeptRule | null,
  go: (url: string) => void = (url) => window.location.assign(url),
): Promise<void> {
  track('Plan', 'Started', 'GithubConnect');
  const url = await startGithubConnect(scope);
  keepGithubDraft(scope.itemId, draft);
  go(url);
}

// What a return says (the GitHub view's words, and the kept rule's): github-hash.ts holds them, where the editor's
// first load reads them without this file's routes.
export { GITHUB_RESULT_WORDS, GITHUB_RULE_WORDS } from './github-hash';
