import type { PreviewApp } from './apps.ts';
import { d1Name, r2Name, workerName, type PrNumber } from './names.ts';

// What a PR owns, in the order it is deleted: the router first releases the hostname before
// anything it routes to disappears (docs/specs/016-platform/blueprints/pr-previews.md "Teardown").
export type TeardownScope = 'all' | 'full';

export type TeardownStep =
  { kind: 'worker'; name: string } | { kind: 'r2'; name: string } | { kind: 'd1'; name: string };

// Workers that bind another go before what they bind: router binds everything, community binds api.
export const TEARDOWN_ORDER: readonly PreviewApp[] = [
  'router',
  'community',
  'marketing',
  'live',
  'telemetry',
  'help',
  'api',
];

export function teardownPlan(pr: PrNumber, scope: TeardownScope): TeardownStep[] {
  const apps = scope === 'all' ? TEARDOWN_ORDER : (['api'] as const);
  return [
    ...apps.map((app) => ({ kind: 'worker' as const, name: workerName(app, pr) })),
    { kind: 'r2', name: r2Name(pr) },
    { kind: 'd1', name: d1Name(pr) },
  ];
}

export function parseScope(value: unknown): TeardownScope {
  if (value === 'all' || value === 'full') return value;
  throw new Error(`unknown teardown scope ${String(value)}`);
}

// A Cloudflare REST response that means the resource is already gone. The status is the
// contract; the codes are the per-product not-found codes, for a 4xx that names one
// (10007 worker script, 10006 R2 bucket, 7404 D1 database).
export const NOT_FOUND_CODES: readonly number[] = [10007, 10006, 7404];

export interface ApiOutcome {
  status: number;
  errors?: readonly { code: number }[];
}

export function isNotFound({ status, errors = [] }: ApiOutcome): boolean {
  return status === 404 || errors.some((e) => NOT_FOUND_CODES.includes(e.code));
}
