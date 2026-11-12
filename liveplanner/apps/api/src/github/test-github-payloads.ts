// GitHub's delivery payloads as the App receives them, the parts a plan reads (docs/specs/026-plan/
// github-pull-requests.md "Pull request state on cards"; blueprint "Part 3"). Not a `.test.ts` file, so vitest does
// not collect it.

// A `pull_request` delivery's payload as GitHub sends it, the parts a plan reads (part 3).
export type PrPayload = {
  repoId?: number;
  installationId?: number;
  action?: string;
  number?: number;
  title?: string;
  body?: string | null;
  state?: 'open' | 'closed';
  draft?: boolean;
  merged?: boolean;
  sha?: string;
  at?: string;
  fullName?: string;
};

export const prPayload = (o: PrPayload = {}) => ({
  action: o.action ?? 'opened',
  installation: { id: o.installationId ?? 7 },
  repository: { id: o.repoId ?? 11, full_name: o.fullName ?? `acme/repo-${o.repoId ?? 11}` },
  pull_request: {
    number: o.number ?? 42,
    title: o.title ?? 'Private title',
    body: o.body ?? null,
    state: o.state ?? 'open',
    draft: o.draft ?? false,
    merged: o.merged ?? false,
    head: { sha: o.sha ?? 'abc1234' },
    updated_at: o.at ?? '2026-11-12T10:00:00Z',
  },
});

// A `check_suite` delivery's payload.
export const suitePayload = (
  o: {
    repoId?: number;
    installationId?: number;
    suiteId?: number;
    sha?: string;
    status?: string;
    conclusion?: string | null;
    at?: string;
  } = {},
) => ({
  action: o.status === 'completed' || o.status === undefined ? 'completed' : 'requested',
  installation: { id: o.installationId ?? 7 },
  repository: { id: o.repoId ?? 11 },
  check_suite: {
    id: o.suiteId ?? 1,
    head_sha: o.sha ?? 'abc1234',
    status: o.status ?? 'completed',
    conclusion: o.conclusion === undefined ? 'success' : o.conclusion,
    updated_at: o.at ?? '2026-11-12T10:00:00Z',
  },
});
