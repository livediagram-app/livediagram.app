import type { LicenceApp } from '@liveworkspace/licences/tables';

// Every deployed app, in the order the page lists them. product.test.ts fails when
// a directory in apps/ is missing here.
export const LICENCE_APPS: readonly LicenceApp[] = [
  { id: 'editor', label: 'Editor', side: 'browser', bundler: 'next' },
  { id: 'marketing', label: 'Website', side: 'browser', bundler: 'next' },
  { id: 'api', label: 'API', side: 'server', bundler: 'worker' },
  { id: 'router', label: 'Router', side: 'server', bundler: 'worker' },
];

// Apps distributed rather than deployed: each package carries its own third-party notices
// (the CLI's dist/THIRD_PARTY_LICENSES, docs/specs/015-api/blueprints/cli.md), so the page leaves them out.
export const DISTRIBUTED_APPS: readonly string[] = ['cli'];

// Apps another Worker bundles: apps/mcp is a package the one MCP (liveworkspace/apps/mcp) runs in process, so
// liveworkspace.app/licences lists what it ships.
export const BUNDLED_ELSEWHERE: readonly string[] = ['mcp'];
