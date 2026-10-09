import type { AppId, Side } from './contract.ts';

export type LicenceApp = { id: AppId; label: string; side: Side; bundler: 'next' | 'worker' };

// Every deployed app, in the order the page lists them. apps.test.ts fails when
// a directory in apps/ is missing here.
export const LICENCE_APPS: readonly LicenceApp[] = [
  { id: 'live', label: 'Editor', side: 'browser', bundler: 'next' },
  { id: 'marketing', label: 'Website', side: 'browser', bundler: 'next' },
  { id: 'help', label: 'Help centre', side: 'browser', bundler: 'next' },
  { id: 'telemetry', label: 'Telemetry', side: 'browser', bundler: 'next' },
  { id: 'community', label: 'Community', side: 'browser', bundler: 'next' },
  { id: 'api', label: 'API', side: 'server', bundler: 'worker' },
  { id: 'mcp', label: 'MCP server', side: 'server', bundler: 'worker' },
  { id: 'router', label: 'Router', side: 'server', bundler: 'worker' },
];

// Apps distributed rather than deployed: each package carries its own third-party notices
// (the CLI's dist/THIRD_PARTY_LICENSES, docs/specs/015-api/blueprints/cli.md), so the page leaves them out.
export const DISTRIBUTED_APPS: readonly string[] = ['cli'];

// Apps the hosted site never bundles, so nothing of theirs belongs on the page: the
// self-hosted runtime runs only in a deployment the operator owns
// (docs/specs/016-platform/self-hosted-runtime.md, "Delivery") and ships as its own image. Named
// here for the same reason the CLI is — every directory in apps/ has to be
// accounted for, or a new app could sit there unmentioned.
export const SELF_HOSTED_APPS: readonly string[] = ['server'];
