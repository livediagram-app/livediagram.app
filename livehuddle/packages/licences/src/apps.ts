import type { LicenceApp } from '@liveworkspace/licences/tables';

// Every deployed app, in the order the page lists them. product.test.ts fails when
// a directory in apps/ is missing here.
export const LICENCE_APPS: readonly LicenceApp[] = [
  { id: 'editor', label: 'Editor', side: 'browser', bundler: 'next' },
  { id: 'marketing', label: 'Website', side: 'browser', bundler: 'next' },
  { id: 'help', label: 'Help centre', side: 'browser', bundler: 'next' },
  { id: 'api', label: 'API', side: 'server', bundler: 'worker' },
  { id: 'router', label: 'Router', side: 'server', bundler: 'worker' },
];

// Apps distributed rather than deployed, which carry their own notices: none since the CLI went
// (docs/specs/002-project-scope/not-in-livehuddle.md).
export const DISTRIBUTED_APPS: readonly string[] = [];
