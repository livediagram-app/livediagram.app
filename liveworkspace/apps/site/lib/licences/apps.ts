import type { LicenceApp } from '@liveworkspace/licences/tables';

// Every deployed app of liveworkspace, in the order liveworkspace.app/licences lists them
// (liveworkspace/docs/specs/010-site/site.md "Licences"). licences.test.ts fails when a directory in
// liveworkspace/apps/ is missing here.
export const LICENCE_APPS: readonly LicenceApp[] = [
  { id: 'site', label: 'Website', side: 'browser', bundler: 'next' },
  { id: 'accounts', label: 'Accounts', side: 'server', bundler: 'worker' },
  { id: 'community', label: 'Community', side: 'server', bundler: 'worker' },
  { id: 'drive', label: 'Google Drive sync', side: 'server', bundler: 'worker' },
  { id: 'export', label: 'Data export', side: 'server', bundler: 'worker' },
  { id: 'index', label: 'Index', side: 'server', bundler: 'worker' },
  { id: 'media', label: 'Media', side: 'server', bundler: 'worker' },
  { id: 'redirect', label: 'Bare-domain redirect', side: 'server', bundler: 'worker' },
  { id: 'status', label: 'Status', side: 'server', bundler: 'worker' },
  { id: 'telemetry', label: 'Telemetry', side: 'server', bundler: 'worker' },
];

/** The page's line about the services, named from the table above so it can't fall behind it: "Accounts, …, Status
 *  and Telemetry". */
export function serverServices(apps: readonly LicenceApp[] = LICENCE_APPS): string {
  const names = apps.filter((a) => a.side === 'server').map((a) => a.label);
  return names.length < 2
    ? (names[0] ?? '')
    : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
}
