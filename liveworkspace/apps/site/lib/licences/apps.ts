import type { LicenceApp } from '@liveworkspace/licences/tables';

// Every deployed app of liveworkspace, in the order liveworkspace.app/licences lists them
// (liveworkspace/docs/site.md "Licences"). licences.test.ts fails when a directory in
// liveworkspace/apps/ is missing here.
export const LICENCE_APPS: readonly LicenceApp[] = [
  { id: 'site', label: 'Website', side: 'browser', bundler: 'next' },
  { id: 'accounts', label: 'Accounts', side: 'server', bundler: 'worker' },
  { id: 'community', label: 'Community', side: 'server', bundler: 'worker' },
  { id: 'index', label: 'Index', side: 'server', bundler: 'worker' },
  { id: 'media', label: 'Media', side: 'server', bundler: 'worker' },
  { id: 'telemetry', label: 'Telemetry', side: 'server', bundler: 'worker' },
];
