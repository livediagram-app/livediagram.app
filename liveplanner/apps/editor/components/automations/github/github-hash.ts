// Coming back from GitHub (docs/specs/026-plan/automations.md "The GitHub view": Coming back from GitHub): the api's
// callback sends the person back to the plan with `#github=connected`, `#github=failed` or `#github=requested`, read
// once as the editor first draws and then dropped from the address, and the rule kept in this tab's session storage
// for the round trip, taken once. Small and eager, since the Automations host reads it on every plan; the screen's own
// code stays in its lazy chunk. Storage that throws (a private window) or holds something unreadable keeps no draft.

import type { AutomationRuleBody } from '@liveplanner/items';
import { track } from '@/lib/telemetry';

export type GithubResult = 'connected' | 'failed' | 'requested';
const RESULTS: readonly string[] = ['connected', 'failed', 'requested'];

const HASH_KEY = 'github';
const draftKey = (projectId: string) => `liveplanner:github-draft:${projectId}`;

/** The result a hash carries, or null. */
export function githubResultOf(hash: string): GithubResult | null {
  const value = new URLSearchParams(hash.replace(/^#/, '')).get(HASH_KEY);
  return value && RESULTS.includes(value) ? (value as GithubResult) : null;
}

/** The result dropped from the address, if it still carries it, so a refresh never says it again. */
export function dropGithubHash(): void {
  if (githubResultOf(window.location.hash) === null) return;
  const url = new URL(window.location.href);
  window.history.replaceState(window.history.state, '', url.pathname + url.search);
}

/** The rule kept for the round trip, taken once. */
export function takeGithubDraft(projectId: string): AutomationRuleBody | null {
  try {
    const text = window.sessionStorage.getItem(draftKey(projectId));
    window.sessionStorage.removeItem(draftKey(projectId));
    if (!text) return null;
    const body = JSON.parse(text) as Partial<AutomationRuleBody> | null;
    const ok =
      !!body &&
      typeof body.name === 'string' &&
      typeof body.trigger?.kind === 'string' &&
      Array.isArray(body.conditions) &&
      Array.isArray(body.steps);
    return ok ? (body as AutomationRuleBody) : null;
  } catch {
    return null;
  }
}

/** The rule kept for the round trip (or none). */
export function keepGithubDraft(projectId: string, draft: AutomationRuleBody | null): void {
  try {
    if (draft) window.sessionStorage.setItem(draftKey(projectId), JSON.stringify(draft));
    else window.sessionStorage.removeItem(draftKey(projectId));
  } catch {
    // No session storage: the person comes back to the GitHub view instead.
  }
}

/** The telemetry a return sends. */
export function trackGithubResult(result: GithubResult): void {
  if (result === 'connected') track('Plan', 'Linked', 'Github');
  else
    track('Plan', 'Ended', result === 'failed' ? 'GithubConnectFailed' : 'GithubConnectRequested');
}
