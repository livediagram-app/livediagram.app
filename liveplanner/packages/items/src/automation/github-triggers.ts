// The GitHub triggers (docs/specs/026-plan/github-pull-requests.md "GitHub triggers"; automations.md "GitHub
// triggers"; blueprint github-pull-requests.md "Part 4"): what a linked pull request's delivery is heard as, which
// trigger hears it, and the Audit Trail's words for it. Pure: the api works out the before and after, this names them.

import type { PullRequestChecks, PullRequestState } from '../pull-request-state';
import { pullRequestUrl, type PullRequestRef } from '../pull-request-fields';
import type { AutomationTrigger, GithubTriggerKind } from './types';

/** What a delivery says a pull request did. */
export type GithubHeard = 'opened' | 'merged' | 'closed' | 'checks_failing' | 'checks_passing';

/** A `pull_request` delivery's action, for a pull request now in `state`: opened (opened or reopened ready for review,
 *  or a draft marked ready), merged, or closed without merging; null for anything else (edited, a draft opening, a
 *  new commit). */
export function heardOfPull(action: string, state: PullRequestState): GithubHeard | null {
  if (action === 'opened' || action === 'reopened' || action === 'ready_for_review')
    return state === 'open' ? 'opened' : null;
  if (action !== 'closed') return null;
  if (state === 'merged') return 'merged';
  return state === 'closed' ? 'closed' : null;
}

type Checked = { state: PullRequestState; checks?: PullRequestChecks };

/** A pull request's checks changing into failing or passing (open or a draft), or null: a suite that agrees with the
 *  checks already held, or one still running, says nothing new. */
export function heardOfChecks(before: Checked | undefined, after: Checked): GithubHeard | null {
  if (after.state !== 'open' && after.state !== 'draft') return null;
  if (after.checks === undefined || after.checks === 'running') return null;
  if (before?.checks === after.checks) return null;
  return after.checks === 'failing' ? 'checks_failing' : 'checks_passing';
}

const HEARS: Readonly<Record<Exclude<GithubTriggerKind, 'pull_request_checks'>, GithubHeard>> = {
  pull_request_opened: 'opened',
  pull_request_merged: 'merged',
  pull_request_closed: 'closed',
};

/** Whether a GitHub trigger hears what the pull request did. */
export function githubHears(
  trigger: Extract<AutomationTrigger, { kind: GithubTriggerKind }>,
  heard: GithubHeard,
): boolean {
  if (trigger.kind === 'pull_request_checks')
    return heard === (trigger.result === 'failing' ? 'checks_failing' : 'checks_passing');
  return HEARS[trigger.kind] === heard;
}

/** What a trigger of `kind` is heard as, for Test on a Card: as if one of the card's pull requests had just done it. */
export function heardOfTrigger(
  trigger: Extract<AutomationTrigger, { kind: GithubTriggerKind }>,
): GithubHeard {
  if (trigger.kind === 'pull_request_checks')
    return trigger.result === 'failing' ? 'checks_failing' : 'checks_passing';
  return HEARS[trigger.kind];
}

const WORDS: Readonly<Record<GithubHeard, string>> = {
  opened: 'opened',
  merged: 'merged',
  closed: 'closed',
  checks_failing: 'checks failing',
  checks_passing: 'checks passing',
};

/** The Audit Trail's first line: "GitHub: acme/web#42 merged" ("a pull request" when it has no name). */
export const githubTriggerWords = (heard: GithubHeard, pr?: string): string =>
  `GitHub: ${pr || 'a pull request'} ${WORDS[heard]}`;

type GithubTrigger = Extract<AutomationTrigger, { kind: GithubTriggerKind }>;

/** Whether a GitHub trigger hears a pull request of `repository` (`owner/name`): it names none, or names that one, any
 *  case. An event with no repository (Test on a Card's) is heard, as if one of the named ones had done it. */
export function githubHearsRepository(trigger: GithubTrigger, repository?: string): boolean {
  const named = trigger.repositories;
  if (!named?.length || repository === undefined) return true;
  const key = repository.toLowerCase();
  return named.some((r) => r.toLowerCase() === key);
}

/** The pull request a GitHub run's values read (`{{pull_request.…}}`), carried on its event: its repository, number,
 *  title, address, and whether its repository is private (spec automations.md "A private repository's title"). */
export type PullRequestValues = {
  repository: string;
  number: number;
  title: string;
  url: string;
  private: boolean;
};

/** A delivery's pull request as its run's values read it. */
export const pullRequestValues = (
  ref: PullRequestRef,
  title: string,
  isPrivate: boolean,
): PullRequestValues => ({
  repository: `${ref.owner}/${ref.repo}`,
  number: ref.number,
  title,
  url: pullRequestUrl(ref),
  private: isPrivate,
});

/** `{{pull_request.title}}`: the title; a private repository's short name (`acme/web#42`) unless the text is an
 *  outgoing message's, so nothing a plan keeps, a share link opens or an email carries ever holds a private title. */
export const pullRequestTitleValue = (pull: PullRequestValues, outgoing: boolean): string =>
  pull.private && !outgoing ? `${pull.repository}#${pull.number}` : pull.title;
